import type { Announcements, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryBoundary } from '@/components/query-boundary';
import { buttonVariants } from '@/components/ui/button';
import { Kanban, KanbanBoard, KanbanColumn, KanbanItem, KanbanItemHandle, KanbanOverlay } from '@/components/ui/kanban';
import { LinkArrow } from '@/components/ui/link-arrow';
import { GripMark } from '@/components/ui/marks';
import { Select } from '@/components/ui/select';
import { usePeople } from '@/features/people/api';
import { useProjects } from '@/features/projects/api';
import { formatDate, localToday, pluralize } from '@/lib/format';
import { formatInr } from '@/lib/money';
import { useAllocations, useMoveAllocation } from './api';
import { buildBoard, byPerson, columnTotals, type BoardCard, type BoardColumn } from './board';

/** The cards of each column, by column key: the shape the Kanban component holds. */
type Columns = Record<string, BoardCard[]>;

const toColumns = (board: readonly BoardColumn[]): Columns =>
  Object.fromEntries(board.map((column) => [column.key, column.cards]));

/** The key of the column that holds the card, or null. */
const columnHolding = (columns: Columns, cardKey: string): string | null =>
  Object.keys(columns).find((key) => columns[key].some((card) => card.key === cardKey)) ?? null;

/** Whether two lists hold the same cards, whatever their order. */
const sameCards = (a: readonly BoardCard[] = [], b: readonly BoardCard[] = []) =>
  a.length === b.length && a.every((card) => b.some((other) => other.key === card.key));

const columnName = (column: BoardColumn) => column.project?.name ?? 'Bench';

const cardLink =
  'inline-flex min-h-11 items-center font-semibold text-foreground decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

const SAVE_FAILED = 'That did not save. The card is back where it was.';

const INSTRUCTIONS =
  'To pick up a card, press space or enter. While you hold it, use the arrow keys to move it between columns. Press space or enter again to drop it there, or escape to cancel. The Move to menu on each card does the same without dragging.';

/**
 * Where everyone is today: the bench first, then a column for each active project, with the monthly salary cost at the
 * head of each. A card moves by dragging its handle to another column, or with the Move to menu on the card, which is
 * the way to do it without dragging. Either one saves a move dated today, which puts the person there from today on;
 * the ledger holds the dated history.
 */
export function AllocationBoard() {
  const people = usePeople();
  const projects = useProjects();
  const entries = useAllocations();
  const move = useMoveAllocation();

  const today = localToday();
  const board = useMemo(
    () => buildBoard({ people: people.data ?? [], projects: projects.data ?? [], entries: entries.data ?? [], today }),
    [people.data, projects.data, entries.data, today]
  );
  const fromService = useMemo(() => toColumns(board), [board]);

  // The cards as they sit on screen. A card dragged over another column moves there at once, before anything is
  // saved, so they differ from the service's until a save is read back (or fails, or the drag is cancelled).
  const [columns, setColumns] = useState<Columns>(fromService);
  const [shown, setShown] = useState(fromService);
  if (shown !== fromService) {
    setShown(fromService);
    setColumns(fromService);
  }

  const latest = useRef({ board, fromService });
  const refocus = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    latest.current = { board, fromService };
  }, [board, fromService]);

  // A card that changes column is a new element in a new place, so the select that was used (and had focus) is
  // replaced: focus goes to its successor, or the keyboard user loses their place.
  useEffect(() => {
    if (refocus.current === null) return;
    document.getElementById(refocus.current)?.focus();
    refocus.current = null;
  });

  /**
   * Saves the card as on the column `targetKey` from today, and shows it there. Nothing is saved for the column it is
   * on already (by the service's account). When the save fails the cards go back to the service's and the board says so.
   */
  async function moveCard(cardKey: string, targetKey: string, focusSelect = false) {
    const { board: current, fromService: saved } = latest.current;
    const origin = columnHolding(saved, cardKey);
    const target = current.find((column) => column.key === targetKey);
    const card = origin === null ? undefined : saved[origin].find((candidate) => candidate.key === cardKey);
    if (!card || !target || origin === targetKey) return;

    const selectId = `move-${cardKey}`;
    setFailed(false);
    if (focusSelect) refocus.current = selectId;
    setColumns((now) => {
      const without = Object.fromEntries(
        Object.entries(now).map(([key, cards]) => [key, cards.filter((c) => c.key !== cardKey)])
      );
      return { ...without, [targetKey]: [...without[targetKey], card].sort(byPerson) };
    });
    try {
      await move.mutateAsync({
        personId: card.person.id,
        projectId: target.project?.id ?? null,
        effectiveDate: localToday(),
      });
    } catch {
      if (focusSelect) refocus.current = selectId;
      setColumns(latest.current.fromService);
      setFailed(true);
    }
  }

  // The Kanban moves a card into the column it is over while it is dragged, and reorders a column's cards on a drop
  // inside it. Only the first is kept: the cards of a column stay sorted by name.
  function onValueChange(next: Columns) {
    if (Object.keys(next).some((key) => !sameCards(columns[key], next[key]))) setColumns(next);
  }

  // The card is where it was dropped, which the Kanban has shown since it went over that column; saving is a move there.
  function onDragEnd({ active, over }: DragEndEvent) {
    const cardKey = String(active.id);
    const now = columnHolding(columns, cardKey);
    if (!over || now === null || now === columnHolding(fromService, cardKey)) {
      setColumns(fromService);
      return;
    }
    void moveCard(cardKey, now);
  }

  const nameOf = (id: UniqueIdentifier) =>
    Object.values(columns)
      .flat()
      .find((card) => card.key === id)?.person.name ?? 'The card';
  const placeOf = (id: UniqueIdentifier) => {
    const key = String(id) in columns ? String(id) : columnHolding(columns, String(id));
    const column = board.find((candidate) => candidate.key === key);
    return column ? columnName(column) : 'no column';
  };
  // The Kanban's own announcements name positions and column keys ("in col-3"); these name the person and the column.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, from ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is over ${placeOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} was dropped on ${placeOf(over.id)}.`
        : `${nameOf(active.id)} was not dropped on a column.`,
    onDragCancel: ({ active }) => `Dragging was cancelled. ${nameOf(active.id)} is back on ${placeOf(active.id)}.`,
  };

  return (
    <QueryBoundary
      isLoading={people.isLoading || projects.isLoading || entries.isLoading}
      isError={people.isError || projects.isError || entries.isError}
      onRetry={() => {
        void people.refetch();
        void projects.refetch();
        void entries.refetch();
      }}
      isEmpty={people.data?.length === 0}
      empty={
        <div className="grid justify-items-start gap-1">
          <p className="text-body">There are no people to put on the board yet.</p>
          <LinkArrow to="/resources/people">Add people</LinkArrow>
        </div>
      }
    >
      {failed ? (
        <p role="alert" className="mb-4 text-small font-semibold text-foreground">
          {SAVE_FAILED}
        </p>
      ) : null}

      <div className="overflow-x-auto pb-4">
        <Kanban
          value={columns}
          onValueChange={onValueChange}
          getItemValue={(card) => card.key}
          onDragEnd={onDragEnd}
          onDragCancel={() => setColumns(fromService)}
          accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
        >
          <KanbanBoard>
            {board.map((column) => {
              const cards = columns[column.key] ?? [];
              const { monthlyCostPaise, withoutSalary } = columnTotals(cards);
              return (
                <KanbanColumn
                  key={column.key}
                  value={column.key}
                  role="group"
                  aria-labelledby={`${column.key}-name`}
                  className="h-auto min-h-48 w-72 shrink-0"
                >
                  <div className="grid gap-1 border-b border-rule pb-3">
                    <h2 id={`${column.key}-name`} className="text-body font-semibold">
                      {column.project ? (
                        <Link
                          to={`/projects/${column.project.id}`}
                          className="decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline"
                        >
                          {column.project.name}
                        </Link>
                      ) : (
                        'Bench'
                      )}
                    </h2>
                    <p className="tabular text-small">
                      {pluralize(cards.length, 'person', 'people')}, {formatInr(monthlyCostPaise)} a month
                    </p>
                    {withoutSalary > 0 ? (
                      <p className="text-small text-navy-80">{withoutSalary} without a salary</p>
                    ) : null}
                  </div>

                  {cards.length === 0 ? (
                    <p className="text-small text-navy-80">
                      {column.project ? 'Nobody is on this project.' : 'Nobody is on the bench.'}
                    </p>
                  ) : (
                    <ul className="grid gap-2">
                      {cards.map((card) => (
                        <KanbanItem key={card.key} value={card.key} asChild>
                          <li className="border border-rule bg-background p-2">
                            <div className="flex items-start gap-1">
                              <KanbanItemHandle
                                aria-label={`Drag ${card.person.name}`}
                                className={buttonVariants({ variant: 'icon' })}
                              >
                                <GripMark />
                              </KanbanItemHandle>
                              <div className="min-w-0 flex-1">
                                <Link to={`/resources/people/${card.person.id}`} className={cardLink}>
                                  {card.person.name}
                                </Link>
                                {card.since !== null || card.note !== null ? (
                                  <p className="tabular text-small text-navy-80">
                                    {card.since !== null ? `since ${formatDate(card.since)}` : card.note}
                                  </p>
                                ) : null}
                                {card.person.monthlySalaryPaise === null ? null : (
                                  <p className="tabular text-small">{formatInr(card.person.monthlySalaryPaise)}</p>
                                )}
                              </div>
                            </div>
                            <Select
                              id={`move-${card.key}`}
                              aria-label={`Move ${card.person.name} to`}
                              value=""
                              className="min-h-11 text-small"
                              onChange={(event) => void moveCard(card.key, event.target.value, true)}
                            >
                              <option value="" disabled>
                                Move to…
                              </option>
                              {board.map((option) => (
                                <option key={option.key} value={option.key}>
                                  {columnName(option)}
                                </option>
                              ))}
                            </Select>
                          </li>
                        </KanbanItem>
                      ))}
                    </ul>
                  )}
                </KanbanColumn>
              );
            })}
          </KanbanBoard>

          <KanbanOverlay>
            {({ value }) => {
              const card = Object.values(columns)
                .flat()
                .find((candidate) => candidate.key === value);
              if (!card) return null;
              return (
                <div className="flex h-full items-center gap-2 border border-navy bg-background px-3 text-navy">
                  <GripMark />
                  <span className="font-semibold">{card.person.name}</span>
                </div>
              );
            }}
          </KanbanOverlay>
        </Kanban>
      </div>
    </QueryBoundary>
  );
}
