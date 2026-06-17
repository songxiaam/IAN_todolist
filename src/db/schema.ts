import {
  pgTable,
  serial,
  timestamp,
  varchar,
  integer,
  uuid,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`auth.uid()`),
    role: varchar('role', { length: 20 }).notNull().default('student'),
    family_id: uuid('family_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    index('profiles_family_id_idx').on(table.family_id),
    index('profiles_role_idx').on(table.role),
  ],
);

export const families = pgTable('families', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const homeworks = pgTable(
  'homeworks',
  {
    id: serial().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    subject: varchar('subject', { length: 50 }).notNull(),
    deadline: timestamp('deadline', { withTimezone: true }),
    estimated_minutes: integer('estimated_minutes').notNull().default(30),
    family_id: uuid('family_id')
      .notNull()
      .references(() => families.id),
    created_by: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    assigned_to: uuid('assigned_to').references(() => profiles.id),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    started_at: timestamp('started_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    index('homeworks_family_id_idx').on(table.family_id),
    index('homeworks_created_by_idx').on(table.created_by),
    index('homeworks_assigned_to_idx').on(table.assigned_to),
    index('homeworks_status_idx').on(table.status),
    index('homeworks_deadline_idx').on(table.deadline),
  ],
);
