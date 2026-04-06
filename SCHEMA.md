# Firestore Schema

This document describes the collections and configuration documents used by Hello Dalat PMS.

## rooms

Stores the inventory of hostel rooms.

Suggested fields:

- `number` (string): Human-readable room number.
- `type` (string): Internal room type key.
- `typeLabel` (string): Display label for UI and invoices.
- `bedConfig` (string): Bed description.
- `capacity` (number): Maximum number of guests.
- `floor` (number): Floor number.
- `icalUrl` (string | null): Linked iCal feed for OTA sync.
- `amenities` (string[]): Room amenities.
- `isActive` (boolean): Availability in the system.
- `createdAt` (timestamp): Creation timestamp.
- `updatedAt` (timestamp): Last update timestamp.

## guests

Stores guest identity and contact information.

Suggested fields:

- `fullName` (string)
- `phone` (string)
- `email` (string)
- `nationality` (string)
- `idType` (string)
- `idNumber` (string)
- `dateOfBirth` (timestamp | null)
- `notes` (string)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## groups

Stores multi-room or multi-guest group bookings.

Suggested fields:

- `name` (string): Group or lead guest name.
- `leadGuestId` (string | null): Reference to the primary guest document ID.
- `bookingIds` (string[]): Booking IDs in the group.
- `guestIds` (string[]): Guest IDs associated with the group.
- `status` (string): Group reservation status.
- `notes` (string)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## bookings

Stores reservations for direct and OTA bookings.

Suggested fields:

- `roomId` (string): Room document ID.
- `guestId` (string | null): Primary guest document ID.
- `groupId` (string | null): Group document ID when applicable.
- `channel` (string): Direct, Booking.com, walk-in, etc.
- `status` (string): Reserved, checked_in, checked_out, cancelled.
- `checkIn` (timestamp)
- `checkOut` (timestamp)
- `nights` (number)
- `adults` (number)
- `children` (number)
- `roomRate` (number)
- `breakfastIncluded` (boolean)
- `breakfastCount` (number)
- `specialRequests` (string)
- `sourceReference` (string): OTA reservation code.
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## finance

Stores income and expense transactions.

Suggested fields:

- `type` (string): `income` or `expense`.
- `category` (string): Finance category key.
- `amount` (number): Transaction amount in VND.
- `currency` (string): Usually `VND`.
- `date` (timestamp): Transaction date.
- `bookingId` (string | null): Related booking document ID.
- `invoiceId` (string | null): Related invoice document ID.
- `description` (string)
- `paymentMethod` (string)
- `createdBy` (string | null)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## invoices

Stores invoices generated for bookings or groups.

Suggested fields:

- `bookingId` (string | null)
- `groupId` (string | null)
- `invoiceNumber` (string)
- `issueDate` (timestamp)
- `lineItems` (array): Itemized charges.
- `subtotal` (number)
- `discount` (number)
- `tax` (number)
- `total` (number)
- `paidAmount` (number)
- `balanceDue` (number)
- `status` (string): Draft, issued, paid, void.
- `notes` (string)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## config/main

Stores hostel-wide configuration for operations and guest communication.

Suggested fields:

- `name` (string)
- `address` (string)
- `phone` (string)
- `email` (string)
- `taxId` (string)
- `wifi` (map): Network credentials.
- `banking` (map): Bank transfer details.
- `checkInTime` (string): `HH:mm`.
- `checkOutTime` (string): `HH:mm`.
- `quietHoursFrom` (string): `HH:mm`.
- `breakfast` (map): Breakfast settings and pricing.
- `googleMaps` (string): Map link.

## config/finance_categories

Stores the available income and expense categories used by finance entries.

Suggested fields:

- `income` (array): Array of `{ key, label }` items.
- `expense` (array): Array of `{ key, label }` items.

## icalSync

Stores synchronization state for room calendar imports.

Suggested fields:

- `roomId` (string): Related room document ID.
- `source` (string): Provider or OTA source.
- `feedUrl` (string)
- `lastSyncedAt` (timestamp | null)
- `lastSuccessAt` (timestamp | null)
- `lastError` (string | null)
- `status` (string): Idle, running, failed.
- `createdAt` (timestamp)
- `updatedAt` (timestamp)