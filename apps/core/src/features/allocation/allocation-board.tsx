import type { Announcements, DragCancelEvent, DragEndEvent, DragStartEvent, UniqueIdentifier } from '@dnd-kit/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFullMain } from '@/components/full-main';
import { QueryBoundary } from '@/components/query-boundary';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kanban, KanbanBoard, KanbanColumn, KanbanItem, KanbanOverlay } from '@/components/ui/kanban';
import { LinkArrow } from '@/components/ui/link-arrow';
import { MoreMark } from '@/components/ui/marks';
import { usePeople } from '@/features/people/api';
import { useProjects } from '@/features/projects/api';
import { localToday } from '@/lib/format';
import { serviceMessage } from '@/lib/core-api';
import { formatInr } from '@/lib/money';
import { useAddCard, useAllocations, useMoveAllocation, useRemoveCard } from './api';
import { buildBoard, byPerson, columnTotals, type BoardCard, type BoardColumn } from './board';

/** The cards of each column, by column key: the shape the Kanban component holds. */
type Columns = Record<string, BoardCard[]>;

const toColumns = (board: readonly BoardColumn[]): Columns =>
  Object.fromEntries(board.map((column) => [column.key, column.cards]));

/** The key of the column that holds the card, or null. */
const columnHolding = (columns: Columns, cardKey: string): string | null =>
  Object.keys(columns).find((key) => columns[key].some((card) => card.key === cardKey)) ?? null;

/**
 * The columns with the card taken out of wherever it is and put in the column `to`, by name. The other columns are
 * untouched. A column that is not there leaves `columns` as they were.
 */
function place(columns: Columns, card: BoardCard, to: string): Columns {
  if (!(to in columns)) return columns;
  const without = Object.fromEntries(
    Object.entries(columns).map(([key, cards]) => [key, cards.filter((candidate) => candidate.key !== card.key)])
  );
  return { ...without, [to]: [...without[to], card].sort(byPerson) };
}

/**
 * The service's columns, except that a card with a save in flight stays in the column it shows in: what the service
 * says now does not yet include its move (or, once the save has landed, says the same). A card that is gone, or whose
 * column is gone, follows the service.
 */
function keepSaving(fromService: Columns, shown: Columns, saving: ReadonlySet<string>): Columns {
  let next = fromService;
  for (const cardKey of saving) {
    const home = columnHolding(fromService, cardKey);
    const showing = columnHolding(shown, cardKey);
    if (home === null || showing === null || showing === home) continue;
    const card = fromService[home].find((candidate) => candidate.key === cardKey);
    if (card) next = place(next, card, showing);
  }
  return next;
}

/** Whether two lists hold the same cards, whatever their order. */
const sameCards = (a: readonly BoardCard[] = [], b: readonly BoardCard[] = []) =>
  a.length === b.length && a.every((card) => b.some((other) => other.key === card.key));

const columnName = (column: BoardColumn) => column.project?.name ?? 'Bench';

/** The person's name, and which of their cards it is when they have several: "Ada Lovelace, card 2 of 3". */
const cardLabel = (card: BoardCard) =>
  card.cardCount > 1 ? `${card.person.name}, card ${card.card} of ${card.cardCount}` : card.person.name;

const cardLink =
  'inline-flex min-h-11 items-center font-semibold text-foreground decoration-teal decoration-2 underline-offset-[0.25em] hover:underline focus-visible:underline';

const SAVE_FAILED = 'That did not save. The card is back where it was.';
/** For a copy or a removal that failed without a message of the service's own: nothing moved, so nothing is back. */
const CARD_SAVE_FAILED = 'That did not save. Try again.';
const KEEPS_ONE = 'A person keeps at least one card';

const INSTRUCTIONS =
  'To pick up a card, focus it and press space or enter. While you hold it, use the arrow keys to move it between columns. Press space or enter again to drop it there, or escape to cancel. The Actions menu on each card moves it without dragging.';

// What dnd-kit says a draggable is: a button, by default. A card holds a link and a button of its own, so it is a list
// item (it is in a list) that is described as a draggable card, and stays in the tab order for the keyboard.
const CARD_ATTRIBUTES = { role: 'listitem', roleDescription: 'draggable card' };

// A press or touch inside the menu is not the card's: it bubbles up the React tree through the portal, where the card's
// drag listeners would take it.
const keepToMenu = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * Where everyone is today: the bench first, then a column for each active project, with the monthly salary cost at the
 * head of each. It fills the area it is given (the page asks the shell for all of it): the row of columns scrolls
 * sideways and each column scrolls its own cards. A card moves by dragging it from anywhere on it to another column, or
 * with the menu at its top right, which is the way to do it without dragging. Either one saves a move dated today,
 * which puts the person there from today on; the ledger holds the dated history.
 */
export function AllocationBoard() {
  useFullMain();
  const people = usePeople();
  const projects = useProjects();
  const entries = useAllocations();
  const move = useMoveAllocation();
  const addCard = useAddCard();
  const removeCard = useRemoveCard();

  const today = localToday();
  const board = useMemo(
    () => buildBoard({ people: people.data ?? [], projects: projects.data ?? [], entries: entries.data ?? [], today }),
    [people.data, projects.data, entries.data, today]
  );
  const fromService = useMemo(() => toColumns(board), [board]);

  // The cards as they sit on screen. A card dragged over another column moves there at once, before anything is
  // saved, so they differ from the service's until the save is read back (or fails, or the drag is cancelled). A card
  // whose save is in flight is locked, so it is never moved twice at once, and stays where it shows when the entries
  // are read again meanwhile; every other card follows the service.
  const [columns, setColumns] = useState<Columns>(fromService);
  const [shown, setShown] = useState(fromService);
  const [saving, setSaving] = useState<ReadonlySet<string>>(() => new Set());
  if (shown !== fromService) {
    setShown(fromService);
    setColumns(keepSaving(fromService, columns, saving));
  }

  // The same set, readable at once: two changes in one tick see each other, where state would not have updated yet.
  const savingNow = useRef(new Set<string>());
  const latest = useRef({ board, fromService });
  const refocus = useRef<string | null>(null);
  // The column a drag began from, which a drop on that column (or on nothing) puts the card back to, and whether it
  // was begun from the keyboard, which has a card to keep its place on.
  const dragFrom = useRef<{ cardKey: string; column: string | null; keyboard: boolean } | null>(null);
  // What the board says when a save did not go through: ours for a move (the card is back where it was), the service's
  // own words for a copy or a removal that it refused.
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    latest.current = { board, fromService };
  }, [board, fromService]);

  // A card that changes column is a new element in a new place, so what had focus (its Actions button, or the card
  // itself in a keyboard drag) is replaced: focus goes to its successor, or the keyboard user loses their place. The
  // successor is locked until its save settles, and a locked card cannot take focus, so this waits for it.
  useEffect(() => {
    if (refocus.current === null) return;
    const target = document.getElementById(refocus.current);
    if (!target || (target as HTMLButtonElement).disabled || target.closest('[data-disabled="true"]')) return;
    target.focus();
    refocus.current = null;
  });

  function lock(cardKeys: readonly string[], locked: boolean) {
    for (const cardKey of cardKeys) {
      if (locked) savingNow.current.add(cardKey);
      else savingNow.current.delete(cardKey);
    }
    setSaving(new Set(savingNow.current));
  }

  /** The keys of every card the person has on the board now. */
  const cardsOfPerson = (personId: number) =>
    Object.values(columns)
      .flat()
      .filter((card) => card.person.id === personId);

  /**
   * Saves the card as on the column `targetKey` from today, and shows it there; `from` is the column it was in. Nothing
   * is saved for the column it is in already. The card is locked until the save settles. When the save fails the card,
   * and only that card, goes back (to where the service has it, by name) and the board says so. `focusId` is the element
   * of the card that has focus and will be replaced: it gets focus again once the card is unlocked.
   */
  async function moveCard(cardKey: string, targetKey: string, from: string | null, focusId?: string) {
    const target = latest.current.board.find((column) => column.key === targetKey);
    const card = Object.values(columns)
      .flat()
      .find((candidate) => candidate.key === cardKey);
    if (!card || !target || from === targetKey || savingNow.current.has(cardKey)) return;

    lock([cardKey], true);
    setFailed(null);
    if (focusId) refocus.current = focusId;
    setColumns((now) => place(now, card, targetKey));
    try {
      await move.mutateAsync({
        personId: card.person.id,
        card: card.card,
        projectId: target.project?.id ?? null,
        effectiveDate: localToday(),
      });
    } catch {
      if (focusId) refocus.current = focusId;
      const back = columnHolding(latest.current.fromService, cardKey) ?? from;
      if (back !== null) setColumns((now) => place(now, card, back));
      setFailed(SAVE_FAILED);
    } finally {
      lock([cardKey], false);
    }
  }

  /**
   * Runs a save that adds or removes a card of a person. It is not shown before it is saved (the new card's number is the
   * service's to give, and the shares of the person's cards change), so every card of the person is locked until the save
   * has settled and the entries read back. A refusal is shown in the service's words.
   */
  async function changeCards(card: BoardCard, save: () => Promise<unknown>, focusId: string) {
    const keys = cardsOfPerson(card.person.id).map((candidate) => candidate.key);
    if (keys.some((key) => savingNow.current.has(key))) return;
    lock(keys, true);
    setFailed(null);
    refocus.current = focusId;
    try {
      await save();
    } catch (error) {
      setFailed(serviceMessage(error) ?? CARD_SAVE_FAILED);
    } finally {
      lock(keys, false);
    }
  }

  /** A copy of the card, on the same project (or the bench), dated today: two cards then stand in one column. */
  function duplicateCard(card: BoardCard) {
    return changeCards(
      card,
      () => addCard.mutateAsync({ personId: card.person.id, projectId: card.projectId, effectiveDate: localToday() }),
      `actions-${card.key}`
    );
  }

  /** The card is removed from today; the person's other card takes its share of the salary. */
  function deleteCard(card: BoardCard) {
    if (card.cardCount < 2) return Promise.resolve();
    // The card is gone once this is saved: focus goes to the person's lowest numbered card that is left.
    const left = cardsOfPerson(card.person.id).find((candidate) => candidate.key !== card.key);
    return changeCards(
      card,
      () => removeCard.mutateAsync({ personId: card.person.id, card: card.card, effectiveDate: localToday() }),
      `actions-${left?.key ?? card.key}`
    );
  }

  /** Puts a card that was being dragged back where the drag began (or where the service has it): only that card. */
  function dropBack(cardKey: string) {
    const from = dragFrom.current?.cardKey === cardKey ? dragFrom.current.column : null;
    const back = from ?? columnHolding(latest.current.fromService, cardKey);
    const card = Object.values(columns)
      .flat()
      .find((candidate) => candidate.key === cardKey);
    if (card && back !== null) setColumns((now) => place(now, card, back));
    if (dragFrom.current?.cardKey === cardKey && dragFrom.current.keyboard) refocus.current = cardKey;
    dragFrom.current = null;
  }

  // The Kanban moves a card into the column it is over while it is dragged, and reorders a column's cards on a drop
  // inside it. Only the first is kept: the cards of a column stay sorted by name.
  function onValueChange(next: Columns) {
    if (Object.keys(next).some((key) => !sameCards(columns[key], next[key]))) setColumns(next);
  }

  function onDragStart({ active, activatorEvent }: DragStartEvent) {
    const cardKey = String(active.id);
    dragFrom.current = {
      cardKey,
      column: columnHolding(columns, cardKey),
      keyboard: activatorEvent instanceof KeyboardEvent,
    };
  }

  // The card is where it was dropped, which the Kanban has shown since it went over that column; saving is a move there.
  // A card that is saving is locked and cannot be dragged, so a drop of one is not its own.
  function onDragEnd({ active, over }: DragEndEvent) {
    const cardKey = String(active.id);
    if (savingNow.current.has(cardKey)) return;
    const now = columnHolding(columns, cardKey);
    const from =
      (dragFrom.current?.cardKey === cardKey ? dragFrom.current.column : null) ??
      columnHolding(latest.current.fromService, cardKey);
    if (!over || now === null || now === from) {
      dropBack(cardKey);
      return;
    }
    const focusId = dragFrom.current?.cardKey === cardKey && dragFrom.current.keyboard ? cardKey : undefined;
    dragFrom.current = null;
    void moveCard(cardKey, now, from, focusId);
  }

  function onDragCancel({ active }: DragCancelEvent) {
    if (!savingNow.current.has(String(active.id))) dropBack(String(active.id));
  }

  const nameOf = (id: UniqueIdentifier) => {
    const card = Object.values(columns)
      .flat()
      .find((candidate) => candidate.key === id);
    return card ? cardLabel(card) : 'The card';
  };
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
      <div className="flex min-h-0 flex-1 flex-col">
        {failed !== null ? (
          <p role="alert" className="mb-3 shrink-0 text-small font-semibold text-foreground">
            {failed}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <Kanban
            value={columns}
            onValueChange={onValueChange}
            getItemValue={(card) => card.key}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
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
                    className="h-full min-h-0 w-72 shrink-0"
                  >
                    <div className="grid shrink-0 gap-1 border-b border-rule pb-3">
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
                      <p className="text-small">
                        <span className="tabular">{cards.length}</span> {cards.length === 1 ? 'card' : 'cards'},{' '}
                        {formatInr(monthlyCostPaise)} a month
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
                      <ul className="-mx-2 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto px-2 py-1">
                        {cards.map((card) => {
                          const menuLabel = `${card.key}-move`;
                          const actionsId = `actions-${card.key}`;
                          const reasonId = `${card.key}-keeps-one`;
                          // A move of one of the person's cards still being saved: a copy or a removal waits for it.
                          const personBusy = cardsOfPerson(card.person.id).some((other) => saving.has(other.key));
                          return (
                            <KanbanItem
                              key={card.key}
                              id={card.key}
                              value={card.key}
                              aria-label={cardLabel(card)}
                              sortableAttributes={CARD_ATTRIBUTES}
                              disabled={saving.has(card.key)}
                              asHandle
                              asChild
                            >
                              <li className="border border-rule bg-background py-1 pl-3 pr-1">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0 flex-1">
                                    <Link to={`/resources/people/${card.person.id}`} className={cardLink}>
                                      {card.person.name}
                                    </Link>
                                    {card.cardCount > 1 ? (
                                      <p className="text-small text-navy-80">
                                        Card {card.card} of {card.cardCount}
                                      </p>
                                    ) : null}
                                    {card.note !== null ? <p className="text-small text-navy-80">{card.note}</p> : null}
                                    {card.salaryShare === null ? null : (
                                      <p className="pb-2 text-small">{formatInr(card.salaryShare)}</p>
                                    )}
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      id={actionsId}
                                      aria-label={`Actions for ${cardLabel(card)}`}
                                      disabled={saving.has(card.key)}
                                      className={buttonVariants({ variant: 'icon' })}
                                    >
                                      <MoreMark />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      aria-labelledby={actionsId}
                                      onMouseDown={keepToMenu}
                                      onTouchStart={keepToMenu}
                                    >
                                      <DropdownMenuGroup aria-labelledby={menuLabel}>
                                        <DropdownMenuLabel id={menuLabel}>Move to</DropdownMenuLabel>
                                        {board
                                          .filter((option) => option.key !== columnHolding(columns, card.key))
                                          .map((option) => (
                                            <DropdownMenuItem
                                              key={option.key}
                                              onSelect={() =>
                                                void moveCard(
                                                  card.key,
                                                  option.key,
                                                  columnHolding(columns, card.key),
                                                  actionsId
                                                )
                                              }
                                            >
                                              {columnName(option)}
                                            </DropdownMenuItem>
                                          ))}
                                      </DropdownMenuGroup>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem disabled={personBusy} onSelect={() => void duplicateCard(card)}>
                                        Duplicate
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={card.cardCount < 2 || personBusy}
                                        aria-describedby={card.cardCount < 2 ? reasonId : undefined}
                                        onSelect={() => void deleteCard(card)}
                                      >
                                        Delete card
                                      </DropdownMenuItem>
                                      {card.cardCount < 2 ? (
                                        <p id={reasonId} className="px-3 pb-2 text-small text-navy-80">
                                          {KEEPS_ONE}
                                        </p>
                                      ) : null}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </li>
                            </KanbanItem>
                          );
                        })}
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
                  <div className="flex h-full items-center border border-navy bg-background px-3 font-semibold text-navy">
                    {cardLabel(card)}
                  </div>
                );
              }}
            </KanbanOverlay>
          </Kanban>
        </div>
      </div>
    </QueryBoundary>
  );
}
