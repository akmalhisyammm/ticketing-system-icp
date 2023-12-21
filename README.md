# Ticketing System

This smart contract is a decentralized ticketing system built on the Internet Computer (IC) using Azle. The system allows organizer to create and sell tickets for their events in a secure, traceable, and transparent manner.

You can always refer to [The Azle Book](https://demergent-labs.github.io/azle/) for more in-depth documentation.

## Requirements

- [Node.js](https://nodejs.org/en/)
- [IC SDK](https://internetcomputer.org/docs/current/developer-docs/setup/quickstart)

## Installation

Clone this repository:

```bash
git clone https://github.com/akmalhisyammm/ticketing-system-icp.git
cd ticketing-system-icp
```

`dfx` is the tool you will use to interact with the IC locally and on mainnet. If you don't already have it installed:

```bash
npm run dfx_install
```

Next you will want to start a replica, which is a local instance of the IC that you can deploy your canisters to:

```bash
npm run replica_start
```

If you ever want to stop the replica:

```bash
npm run replica_stop
```

Now you can deploy your canister locally:

```bash
npm install
npm run canister_deploy_local
```

To call the methods on your canister:

```bash
npm run canister_call <METHOD_NAME>
```

Assuming you have [created a cycles wallet](https://internetcomputer.org/docs/current/developer-docs/quickstart/network-quickstart) and funded it with cycles, you can deploy to mainnet like this:

```bash
npm run canister_deploy_mainnet
```

## Methods

- **createUser**: This method is used to create a new user. There are two valid user roles, `organizer` for ticket seller and `participant` for ticket buyer. Please choose it wisely.
- **createEvent**: This method is used to create a new event. Only users with the `organizer` role can use this method.
- **createTickets**: This method is used to create new tickets. Only users with the `organizer` role can use this method.
- **getMe**: This method is used to retrieve the current user.
- **getEvents**: This method is used to retrieve all events.
- **getTicketsByEvent**: This method is used to retrieve all tickets for an event.
- **getMyTickets**: This method is used to retrieve all current user's tickets.
- **getMyTransactions**: This method is used to retrieve all current user's transactions.
- **buyTicket**: This method is used to buy a ticket. Only users with the `participant` role can use this method.
- **transferTicket**: This method is used to transfer owned ticket to another participant. Only users with the `participant` role can use this method.

## License

This smart contract is licensed under MIT License. Please see the [LICENSE](./LICENSE) for more information.
