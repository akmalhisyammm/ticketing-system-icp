import {
  Canister,
  Err,
  None,
  Ok,
  Opt,
  Principal,
  Record,
  Result,
  Some,
  StableBTreeMap,
  Variant,
  Vec,
  ic,
  nat32,
  nat64,
  query,
  text,
  update,
} from 'azle';
import { v4 as uuidv4 } from 'uuid';

// Define user and ticket roles.
const USER_ROLES = ['organizer', 'participant'];
const TICKET_ROLES = ['vvip', 'vip', 'regular'];

// Initialize records.
const User = Record({
  id: Principal,
  name: text,
  role: text,
  createdAt: nat64,
  updatedAt: nat64,
});

const Event = Record({
  id: text,
  name: text,
  date: nat64,
  location: text,
  organizerId: Principal,
  createdAt: nat64,
  updatedAt: nat64,
});

const Ticket = Record({
  id: text,
  role: text,
  price: nat64,
  eventId: text,
  participantId: Opt(Principal),
  organizerId: Principal,
  createdAt: nat64,
  updatedAt: nat64,
});

const Transaction = Record({
  id: text,
  mode: text,
  pay: nat64,
  ticketId: text,
  senderId: Opt(Principal),
  participantId: Principal,
  organizerId: Principal,
  createdAt: nat64,
  updatedAt: nat64,
});

const UserPayload = Record({
  name: text,
  role: text,
});

const EventPayload = Record({
  name: text,
  date: nat64,
  location: text,
});

const TicketPayload = Record({
  role: text,
  price: nat64,
  eventId: text,
});

const TransactionPayload = Record({
  pay: nat64,
  ticketId: text,
});

// Initialize error variants.
const Error = Variant({
  NotFound: text,
  Unauthorized: text,
  Forbidden: text,
  BadRequest: text,
  InternalError: text,
});

// Initialize storages.
const userStorage = StableBTreeMap(Principal, User, 0);
const eventStorage = StableBTreeMap(text, Event, 1);
const ticketStorage = StableBTreeMap(text, Ticket, 2);
const transactionStorage = StableBTreeMap(text, Transaction, 3);

// Helper function to check whether the string is empty.
const isStringEmpty = (str: string): boolean => !str.trim().length;

// Helper function to check whether the user exists.
const isUserExists = (id: Principal) => userStorage.containsKey(id);

// Helper function to check whether the event exists.
const isEventExists = (id: string) => eventStorage.containsKey(id);

// Helper function to check whether the ticket exists.
const isTicketExists = (id: string) => ticketStorage.containsKey(id);

// Helper function to check whether the user is an organizer.
const isUserOrganizer = (id: Principal) => userStorage.get(id).Some.role === 'organizer';

// Helper function to check whether the user is the owner of the product.
const isProductOwner = (id: Principal, ownerId: Principal) => id.toText() === ownerId.toText();

// Export the canister.
export default Canister({
  /**
   * Creates a new user.
   * @param payload - Payload for creating a new user.
   * @returns the created user or an error.
   */
  createUser: update([UserPayload], Result(User, Error), (payload) => {
    try {
      // If name or role is empty, return error.
      if (isStringEmpty(payload.name) || isStringEmpty(payload.role)) {
        Err({ BadRequest: 'Name and role cannot be empty' });
      }

      // If role is not valid, return error.
      if (!USER_ROLES.includes(payload.role)) {
        return Err({ BadRequest: 'Please input a valid role (organizer or participant)' });
      }

      // If user already exists, return error.
      if (isUserExists(ic.caller())) {
        return Err({ BadRequest: 'You already have an account' });
      }

      // Create new user, insert it into storage and return it.
      const newUser = {
        id: ic.caller(),
        createdAt: ic.time(),
        updatedAt: ic.time(),
        ...payload,
      };
      userStorage.insert(newUser.id, newUser);
      return Ok(newUser);
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Creates a new event.
   * @param payload - Payload for creating a new event.
   * @returns the created event or an error.
   */
  createEvent: update([EventPayload], Result(Event, Error), (payload) => {
    try {
      // If user does not exist, return error.
      if (!isUserExists(ic.caller())) {
        return Err({ Unauthorized: 'Create an account first' });
      }

      // If user is not an organizer, return error.
      if (!isUserOrganizer(ic.caller())) {
        return Err({ Forbidden: 'Only organizers can create events' });
      }

      // If name, date or location is empty, return error.
      if (isStringEmpty(payload.name) || isStringEmpty(payload.location) || !payload.date) {
        return Err({ BadRequest: 'Name, date and location cannot be empty' });
      }

      // If date is not greater than current time, return error.
      if (payload.date <= ic.time()) {
        return Err({ BadRequest: 'Date must be a date in the future' });
      }

      // Create new event, insert it into storage and return it.
      const newEvent = {
        id: uuidv4(),
        organizerId: ic.caller(),
        createdAt: ic.time(),
        updatedAt: ic.time(),
        ...payload,
      };
      eventStorage.insert(newEvent.id, newEvent);
      return Ok(newEvent);
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Creates new tickets.
   * @param quantity - Quantity of tickets to be created.
   * @param payload - Payload for creating new tickets.
   * @returns the created tickets or an error.
   */
  createTickets: update([nat32, TicketPayload], Result(Vec(Ticket), Error), (quantity, payload) => {
    try {
      // If user does not exist, return error.
      if (!isUserExists(ic.caller())) {
        return Err({ Unauthorized: 'Create an account first' });
      }

      // If user is not an organizer, return error.
      if (!isUserOrganizer(ic.caller())) {
        return Err({ Forbidden: 'Only organizers can create tickets' });
      }

      // If quantity, role, price, or event id is empty, return error.
      if (
        !quantity ||
        !payload.price ||
        isStringEmpty(payload.role) ||
        isStringEmpty(payload.eventId)
      ) {
        return Err({ BadRequest: 'Quantity, role, price and event ID cannot be empty' });
      }

      // If quantity is not greater than 0, return error.
      if (quantity <= 0) {
        return Err({ BadRequest: 'Quantity must be greater than 0' });
      }

      // If price is not greater than 0, return error.
      if (payload.price <= 0) {
        return Err({ BadRequest: 'Price must be greater than 0' });
      }

      // If ticket role is not valid, return error.
      if (!TICKET_ROLES.includes(payload.role)) {
        return Err({ BadRequest: 'Please input a valid role (vvip, vip or regular)' });
      }

      // If event does not exist, return error.
      if (!isEventExists(payload.eventId)) {
        return Err({ NotFound: `Event with id ${payload.eventId} not found` });
      }

      // Get event from storage.
      const event = eventStorage.get(payload.eventId);

      // If user is not the event owner, return error.
      if (!isProductOwner(ic.caller(), event.Some.organizerId)) {
        return Err({ Forbidden: 'Only event owner can create tickets' });
      }

      // If event has already started, return error.
      if (event.Some.date <= ic.time()) {
        return Err({ BadRequest: 'Event already started' });
      }

      // Create new tickets, insert them into storage and return them.
      const newTickets = [];
      for (let i = 0; i < quantity; i++) {
        const newTicket = {
          id: uuidv4(),
          participantId: None,
          organizerId: ic.caller(),
          createdAt: ic.time(),
          updatedAt: ic.time(),
          ...payload,
        };
        ticketStorage.insert(newTicket.id, newTicket);
        newTickets.push(newTicket);
      }
      return Ok(newTickets);
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Retrieves the current user.
   * @returns the current user or an error.
   */
  getMe: query([], Result(User, Error), () => {
    try {
      // If user does not exist, return error.
      if (!isUserExists(ic.caller())) {
        return Err({ Unauthorized: 'Create an account first' });
      }

      // Return the current user.
      const user = userStorage.get(ic.caller()).Some;
      return Ok(user);
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Retrieves all events.
   * @returns all events or an error.
   */
  getEvents: query([], Result(Vec(Event), Error), () => {
    try {
      // Return all events.
      const events = eventStorage.values();
      return Ok(events);
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Retrieves all tickets for an event.
   * @param eventId - Id of the event.
   * @returns all tickets for an event or an error.
   */
  getEventTickets: query([text], Result(Vec(Ticket), Error), (eventId) => {
    try {
      // If event does not exist, return error.
      if (!isEventExists(eventId)) {
        return Err({ NotFound: `Event with id ${eventId} not found` });
      }

      // Return all tickets for an event.
      const tickets = ticketStorage.values();
      return Ok(tickets.filter((ticket: typeof Ticket) => ticket.eventId === eventId));
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Retrieves all current user's tickets.
   * @returns all current user's tickets or an error.
   */
  getMyTickets: query([], Result(Vec(Ticket), Error), () => {
    try {
      // If user does not exist, return error.
      if (!isUserExists(ic.caller())) {
        return Err({ Unauthorized: 'Create an account first' });
      }

      // Get user role.
      const role = userStorage.get(ic.caller()).Some.role;

      // Return all current user's tickets.
      const tickets = ticketStorage.values();
      return Ok(
        tickets.filter((ticket: typeof Ticket) =>
          role === 'organizer'
            ? ticket.organizerId.toText() === ic.caller().toText()
            : ticket.participantId.Some?.toText() === ic.caller().toText()
        )
      );
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Retrieves all current user's transactions.
   * @returns all current user's transactions or an error.
   */
  getMyTransactions: query([], Result(Vec(Transaction), Error), () => {
    try {
      // If user does not exist, return error.
      if (!isUserExists(ic.caller())) {
        return Err({ Unauthorized: 'Create an account first' });
      }

      // Get user role.
      const role = userStorage.get(ic.caller()).Some.role;

      // Return all current user's transactions.
      const transactions = transactionStorage.values();
      return Ok(
        transactions.filter((transaction: typeof Transaction) =>
          role === 'organizer'
            ? transaction.organizerId.toText() === ic.caller().toText()
            : transaction.participantId.toText() === ic.caller().toText() ||
              transaction.senderId.Some?.toText() === ic.caller().toText()
        )
      );
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Buys a ticket.
   * @param payload - Payload for buying a ticket.
   * @returns the transaction or an error.
   */
  buyTicket: update([TransactionPayload], Result(Transaction, Error), (payload) => {
    try {
      // If user does not exist, return error.
      if (!isUserExists(ic.caller())) {
        return Err({ Unauthorized: 'Create an account first' });
      }

      // If user is an organizer, return error.
      if (isUserOrganizer(ic.caller())) {
        return Err({ Forbidden: 'Only participants can buy tickets' });
      }

      // If pay or ticket id is empty, return error.
      if (!payload.pay || isStringEmpty(payload.ticketId)) {
        return Err({ BadRequest: 'Pay and ticket ID cannot be empty' });
      }

      // If ticket does not exist, return error.
      if (!isTicketExists(payload.ticketId)) {
        return Err({ NotFound: `Ticket with id ${payload.ticketId} not found` });
      }

      // Get ticket from storage.
      const ticket = ticketStorage.get(payload.ticketId);

      // If pay is not equal to ticket price, return error.
      if (ticket.Some.price !== payload.pay) {
        return Err({ BadRequest: `Please pay the exact ticket price: ${ticket.Some.price}` });
      }

      // If ticket has already been sold, return error.
      if (!!ticket.Some.participantId.Some) {
        return Err({ BadRequest: 'Ticket has already been sold' });
      }

      // Create new transaction, insert it into storage and return it.
      const newTransaction = {
        id: uuidv4(),
        mode: 'buy',
        senderId: None,
        participantId: ic.caller(),
        organizerId: ticket.Some.organizerId,
        createdAt: ic.time(),
        updatedAt: ic.time(),
        ...payload,
      };
      ticketStorage.insert(ticket.Some.id, {
        ...ticket.Some,
        participantId: Some(newTransaction.participantId),
        updatedAt: ic.time(),
      });
      transactionStorage.insert(newTransaction.id, newTransaction);
      return Ok(newTransaction);
    } catch (error) {
      // If any error occurs, return it.
      return Err({ InternalError: `${error}` });
    }
  }),

  /**
   * Transfers a ticket.
   * @param ticketId - Id of the ticket to be transferred.
   * @param participantId - Id of the participant to receive the ticket.
   * @returns the transaction or an error.
   */
  transferTicket: update(
    [text, Principal],
    Result(Transaction, Error),
    (ticketId, participantId) => {
      try {
        // If sender does not exist, return error.
        if (!isUserExists(ic.caller())) {
          return Err({ Unauthorized: 'Create an account first' });
        }

        // If ticket id or participant id is empty, return error.
        if (isStringEmpty(ticketId) || !participantId) {
          return Err({ BadRequest: 'Ticket ID and participant ID cannot be empty' });
        }

        // If receiver does not exist, return error.
        if (!isUserExists(participantId)) {
          return Err({ NotFound: `User with id ${participantId} not found` });
        }

        // If sender and receiver are the same, return error.
        if (isProductOwner(ic.caller(), participantId)) {
          return Err({ BadRequest: 'You cannot transfer to yourself' });
        }

        // If sender or receiver is an organizer, return error.
        if (isUserOrganizer(ic.caller()) || isUserOrganizer(participantId)) {
          return Err({ Forbidden: 'Only participants can transfer tickets' });
        }

        // If ticket does not exist, return error.
        if (!isTicketExists(ticketId)) {
          return Err({ NotFound: `Ticket with id ${ticketId} not found` });
        }

        // Get ticket from storage.
        const ticket = ticketStorage.get(ticketId);

        // If user is not the ticket owner, return error.
        if (!isProductOwner(ic.caller(), ticket.Some.participantId.Some)) {
          return Err({ Forbidden: 'Only ticket owner can transfer it' });
        }

        // Create new transaction, insert it into storage and return it.
        const newTransaction = {
          id: uuidv4(),
          mode: 'transfer',
          pay: 0n,
          ticketId: ticket.Some.id,
          senderId: Some(ic.caller()),
          participantId,
          organizerId: ticket.Some.organizerId,
          createdAt: ic.time(),
          updatedAt: ic.time(),
        };
        ticketStorage.insert(ticket.Some.id, {
          ...ticket.Some,
          participantId: Some(newTransaction.participantId),
          updatedAt: ic.time(),
        });
        transactionStorage.insert(newTransaction.id, newTransaction);
        return Ok(newTransaction);
      } catch (error) {
        // If any error occurs, return it.
        return Err({ InternalError: `${error}` });
      }
    }
  ),
});

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
