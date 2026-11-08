//defining schema here
import { pgTable, integer, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/relations';
const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
    .$onUpdate(() => new Date()).notNull(),
}
export const departments = pgTable('departments', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),//ties it to entity
  name: varchar('name', {length: 50}).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 255 }).notNull(),
  ...timestamps//destructure at button of every new table
});
export const subjects = pgTable('subjects', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),//ties it to entity
  name: varchar('name', {length: 50}).notNull(),
  departmentId: integer('department_id').notNull().references(() => departments.id, {onDelete: 'restrict'}),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 255 }).notNull(),
  ...timestamps//destructure at button of every new table
});
//table destructure returns a new object with the properties of the original object, but with the properties of the destructured object overwritten by the properties of the new object. This is useful for creating new objects that are based on existing objects, but with some properties changed.
//creates relation btw dept and subjects, one to many relationship, one dept can have many subjects, but one subject can only belong to one dept
export const departmentRelations = relations(departments, ({ many}) => ({ subjects: many(subjects)} ))
export const subjectRelations = relations(subjects, ({ one, many }) => ({ 
    department: one(departments, {
        fields:[subjects.departmentId],
        references:[departments.id]
    }) 
}))
//makes in sync with the database, so that the database is always up to date with the latest schema changes. 
// This is useful for development, but should be disabled in production.
// $infer auto generate types for the tables, so that we can use them in our code. This is useful for type checking, and for generating types for the tables in the database.
//app types stay in sync eith db, autogenerate types based on db schema

export type Department = typeof departments.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
export type NewDepartment = typeof departments.$inferInsert;

//ai auto migrate and generate 