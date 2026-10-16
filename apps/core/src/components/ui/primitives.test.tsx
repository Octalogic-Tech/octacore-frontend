import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Badge } from './badge';
import { Button } from './button';
import { Field, fieldA11y } from './field';
import { Input } from './input';
import { LinkArrow } from './link-arrow';
import { Panel } from './panel';
import { Select } from './select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Textarea } from './textarea';

describe('Button', () => {
  it('renders its label with a decorative arm cell', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('does not submit a form unless it is a submit button', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Plain</Button>
        <Button type="submit">Send</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Plain' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('has no arm cell in the quiet variant', () => {
    render(<Button variant="quiet">Edit</Button>);
    expect(screen.getByRole('button', { name: 'Edit' }).querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('cannot be clicked while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('links the label to the control', () => {
    render(
      <Field label="Name" htmlFor="name">
        <Input id="name" />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('announces an error and points the control at it', () => {
    render(
      <Field label="Name" htmlFor="name" error="Name is required">
        <Input {...fieldA11y('name', 'Name is required')} />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'name-error');
  });

  it('shows the hint only while there is no error', () => {
    const { rerender } = render(
      <Field label="Phone" htmlFor="phone" hint="If you would rather we call.">
        <Input id="phone" />
      </Field>,
    );
    expect(screen.getByText('If you would rather we call.')).toBeInTheDocument();
    rerender(
      <Field label="Phone" htmlFor="phone" hint="If you would rather we call." error="Too short">
        <Input id="phone" />
      </Field>,
    );
    expect(screen.queryByText('If you would rather we call.')).not.toBeInTheDocument();
  });

  it('keeps its label and control at the top of its cell, so a neighbour with a hint cannot push them down', () => {
    // A grid stretches every field to the tallest in its row and, left alone, spreads the extra height between the
    // label and the control. jsdom has no layout, so this pins the class that stops it.
    render(
      <Field label="Name" htmlFor="name">
        <Input id="name" />
      </Field>,
    );
    expect(screen.getByLabelText('Name').closest('[data-slot="field"]')).toHaveClass('content-start');
  });

  it('gives fieldA11y no error attributes when valid', () => {
    expect(fieldA11y('x')).toEqual({ id: 'x', 'aria-invalid': undefined, 'aria-describedby': undefined });
  });
});

describe('Textarea and Select', () => {
  it('accept typing and selection', async () => {
    render(
      <>
        <Textarea aria-label="Notes" />
        <Select aria-label="Type">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>
      </>,
    );
    await userEvent.type(screen.getByLabelText('Notes'), 'hello');
    expect(screen.getByLabelText('Notes')).toHaveValue('hello');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'b');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('b');
  });
});

describe('Badge', () => {
  it('is navy filled by default and outlined on request', () => {
    render(
      <>
        <Badge>Approved</Badge>
        <Badge variant="outline">Pending</Badge>
      </>,
    );
    expect(screen.getByText('Approved')).toHaveClass('bg-navy');
    expect(screen.getByText('Pending')).toHaveClass('border-navy');
    expect(screen.getByText('Pending')).not.toHaveClass('bg-navy');
  });
});

describe('Table', () => {
  it('renders column headers and cells', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Web</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Web' })).toBeInTheDocument();
  });
});

describe('Panel', () => {
  it('shows its content and draws the cut corner as a decorative svg', () => {
    const { container } = render(<Panel>Inside</Panel>);
    expect(screen.getByText('Inside')).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('LinkArrow', () => {
  it('is a link with the arm arrow', () => {
    render(
      <MemoryRouter>
        <LinkArrow to="/projects">All projects</LinkArrow>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'All projects' });
    expect(link).toHaveAttribute('href', '/projects');
    expect(link.querySelector('.arm-arrow')).not.toBeNull();
  });
});
