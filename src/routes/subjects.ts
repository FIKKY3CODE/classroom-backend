//routes/subjects.ts
import express from "express";
import { subjects, departments } from "../db/schema";
// Drizzle helper functions:
// - or: combines conditions with SQL OR (e.g., name LIKE %x% OR code LIKE %x%)
// - ilike: case-insensitive pattern matching (SQL ILIKE)
// - and: combines conditions with SQL AND
// - sql: allows writing raw SQL snippets inside Drizzle queries (used here for count)
// - eq: tests equality between columns/values (SQL =)
// - getTableColumns: helper that extracts all column definitions from a table schema
// - desc: sorts results in descending order (newest first)
import { or, ilike, and, sql, eq, getTableColumns, desc } from "drizzle-orm";
import { db } from "../db";

const router = express.Router();

// GET all subjects with optional search query
router.get('/', async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query;

        // +limit means convert limit to a number, if limit is not a number, it will be NaN, and Math.max will return NaN, which will be converted to 1 by the || operator. This is useful for pagination, as it ensures that the user cannot request a page number less than 1, which would result in an error.
        // ensures that the page number is at least 1, and if not, it sets it to 1. This is useful for pagination, as it ensures that the user cannot request a page number less than 1, which would result in an error.
        // Number(page) || 1 provides extra safety if the query parameter is passed as an invalid string like ?page=abc
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); // Limit the page size to 100
        
        //Tells PostgreSQL how many rows to skip. If you are on page 3 with a limit of 10, it skips the first 20 items ((3 - 1) * 10 = 20) and fetches items 21 through 30.
        // offset is how many records to skip to get to the next page.
        // For example: Page 2 with limit 10 skips (2 - 1) * 10 = 10 records.
        const offset = (currentPage - 1) * limitPerPage;

        // define array to store filter conditions
        const filterconditions = [];

        // Helper to escape regex/LIKE special characters in user input to prevent wildcard manipulation
        const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

        // if search query exists filter by subject name or subject code
        if (search && typeof search === 'string') {
            const safeSearch = escapeLike(search);
            filterconditions.push(
                or(
                    //% is a wildcard that matches any number of characters, so that we can search for subjects that contain the search string anywhere in their name or code. This is useful for searching, as it allows the user to find subjects even if they don't know the exact name or code.
                    // SQL equivalent: subjects.name ILIKE '%search%'
                    ilike(subjects.name, `%${safeSearch}%`),
                    // SQL equivalent: subjects.code ILIKE '%search%'
                    ilike(subjects.code, `%${safeSearch}%`)
                )
            );
        }

        // if department query exists, filter by department name
        if (department && typeof department === 'string') {
            // FIXED: Properly interpolate the department variable instead of literal $String text
            const deptPattern = `${escapeLike(department)}%`; 
            // SQL equivalent: departments.name ILIKE 'department%'
            filterconditions.push(ilike(departments.name, deptPattern));
        }

        // combine all filters using AND operator if any exist, so that all filters must be true for a record to be returned
        // If filterconditions is empty, whereClause becomes `undefined`. Drizzle safely ignores `undefined` and fetches all rows without a WHERE block.
        const whereClause = filterconditions.length > 0 ? and(...filterconditions) : undefined;

        // QUERY 1: Fetch total count matching the filters (needed to calculate total pages)
        // leftjoin returns all records from the left table (subjects) and the matched records from the right table (departments). If there is no match, the result is NULL on the right side. This is useful for getting all subjects, even if they don't have a department.
        // eq is used to compare the departmentId in subjects table with the id in departments table, so that we can filter by department name. This is useful for getting all subjects that belong to a specific department.
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        // Extract raw count number (PostgreSQL returns count as a string, so we wrap with Number())
        const totalCount = Number(countResult[0]?.count || 0);

        // fetching actual paginated data
        // QUERY 2: Fetch the actual list of subjects for the requested page
        const subjectsList = await db
            .select({
                // Spreads all columns from subjects table (id, name, code, etc.) into the top level of the object
                ...getTableColumns(subjects),
                // Groups all department columns under a nested `department` object property
                department: { ...getTableColumns(departments) }
            })
            .from(subjects)
            // Links the subject to its parent department using their matching IDs
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            // Sort newest subjects first, with id as a tie-breaker for consistent pagination
            .orderBy(desc(subjects.createdAt), desc(subjects.id)) 
            .limit(limitPerPage)                // Take only the specified number of items
            .offset(offset);                    // Skip the items from earlier pages

        // Send successful JSON response with retrieved records and pagination info
        res.status(200).json({  
            data: subjectsList,
            pagination: {
                total: totalCount,
                page: currentPage,
                limit: limitPerPage,
                // MATH.CEIL rounds up to the nearest integer, so that if there are 11 records and the limit is 10, it will return 2 pages instead of 1. This is useful for pagination, as it ensures that the user can access all records, even if they don't fit on a single page.
                totalPages: Math.ceil(totalCount / limitPerPage)
            }
        });
    } catch (err) {
        // Log backend server errors to terminal for debugging
        console.error("Error in GET /subjects route:", err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;