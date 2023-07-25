import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const columns = [
  { id: 'name', label: 'Name', minWidth: 170 },
  { id: 'created', label: 'Created', minWidth: 150 },
  { id: 'updated', label: 'Updated', minWidth: 150 },
  { id: 'action', label: 'Action', minWidth: 120 },
];

const rows = [
  { id: 1, name: 'Category 1', created: '2023-07-25', updated: '2023-07-25' },
  { id: 2, name: 'Category 2', created: '2023-07-25', updated: '2023-07-25' },
  { id: 3, name: 'Category 3', created: '2023-07-25', updated: '2023-07-25' },
  { id: 4, name: 'Category 4', created: '2023-07-25', updated: '2023-07-25' },
  { id: 5, name: 'Category 5', created: '2023-07-25', updated: '2023-07-25' },
  { id: 6, name: 'Category 6', created: '2023-07-25', updated: '2023-07-25' },
  { id: 7, name: 'Category 7', created: '2023-07-25', updated: '2023-07-25' },
  { id: 8, name: 'Category 8', created: '2023-07-25', updated: '2023-07-25' },
  { id: 9, name: 'Category 9', created: '2023-07-25', updated: '2023-07-25' },
  { id: 10, name: 'Category 10', created: '2023-07-25', updated: '2023-07-25' },
  { id: 11, name: 'Category 11', created: '2023-07-25', updated: '2023-07-25' },
  { id: 12, name: 'Category 12', created: '2023-07-25', updated: '2023-07-25' },
];

export interface CategoriesTableProps {
  categoriesArray: Array<string>;
}

function CategoriesTable(props: CategoriesTableProps) {
  const { categoriesArray } = props;
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  const handleChangePage = (event: unknown, newPage: number) => {
    console.log(newPage);
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleEditClick = (rowId: number) => {
    console.log('Edit clicked for row:', rowId);
  };

  const handleDeleteClick = (rowId: number) => {
    console.log('Delete clicked for row:', rowId);
  };

  return (
    <Paper sx={{ width: { xs: '100vw', sm: '100%' } }}>
      <TableContainer sx={{ maxHeight: '400px' }}>
        <Table size="small" stickyHeader aria-label="sticky table">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.id === 'action' ? 'center' : 'left'}
                  style={{ minWidth: column.minWidth }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => {
                return (
                  <TableRow key={row.id}>
                    <TableCell align="left">{row.name}</TableCell>
                    <TableCell align="left">{row.created}</TableCell>
                    <TableCell align="left">{row.updated}</TableCell>
                    <TableCell align="center">
                      <IconButton onClick={() => handleEditClick(row.id)}>
                        <EditIcon color="secondary" />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteClick(row.id)}>
                        <DeleteIcon color="error" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 20]}
        component="div"
        count={rows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
}

export default CategoriesTable;
