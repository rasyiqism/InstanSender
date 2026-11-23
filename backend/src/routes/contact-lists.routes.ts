import { Elysia, t } from 'elysia';
import { db, schema } from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { authContext } from '../common/middleware';

export const contactListRoutes = new Elysia({ prefix: '/contact-lists' })
  .use(authContext)
  // 1. List contact lists with contact count
  .get('/', async ({ getAuthUser }) => {
    const user = await getAuthUser();
    const lists = await db
      .select({
        id: schema.contactLists.id,
        name: schema.contactLists.name,
        userId: schema.contactLists.userId,
        createdAt: schema.contactLists.createdAt,
        contactCount: sql<number>`count(${schema.contacts.id})::int`,
      })
      .from(schema.contactLists)
      .leftJoin(schema.contacts, eq(schema.contacts.contactListId, schema.contactLists.id))
      .where(eq(schema.contactLists.userId, user.id))
      .groupBy(schema.contactLists.id)
      .orderBy(desc(schema.contactLists.createdAt));

    return lists;
  })
  // 2. Create list
  .post(
    '/',
    async ({ body, getAuthUser }) => {
      const user = await getAuthUser();
      const [list] = await db
        .insert(schema.contactLists)
        .values({
          userId: user.id,
          name: body.name.trim(),
        })
        .returning();

      return {
        ...list,
        contactCount: 0,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
      }),
    },
  )
  // 3. Get list details with contacts
  .get('/:id', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [list] = await db
      .select()
      .from(schema.contactLists)
      .where(and(eq(schema.contactLists.id, params.id), eq(schema.contactLists.userId, user.id)))
      .limit(1);

    if (!list) {
      set.status = 404;
      return { message: 'Daftar kontak tidak ditemukan' };
    }

    const contactsList = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.contactListId, params.id))
      .orderBy(desc(schema.contacts.createdAt));

    return {
      ...list,
      contacts: contactsList,
    };
  })
  // 4. Delete list
  .delete('/:id', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [list] = await db
      .select()
      .from(schema.contactLists)
      .where(and(eq(schema.contactLists.id, params.id), eq(schema.contactLists.userId, user.id)))
      .limit(1);

    if (!list) {
      set.status = 404;
      return { message: 'Daftar kontak tidak ditemukan' };
    }

    await db.delete(schema.contacts).where(eq(schema.contacts.contactListId, params.id));
    await db.delete(schema.contactLists).where(eq(schema.contactLists.id, params.id));

    return { success: true };
  })
  // 5. Add single contact
  .post(
    '/:id/contacts',
    async ({ params, body, getAuthUser, set }) => {
      const user = await getAuthUser();
      const [list] = await db
        .select()
        .from(schema.contactLists)
        .where(and(eq(schema.contactLists.id, params.id), eq(schema.contactLists.userId, user.id)))
        .limit(1);

      if (!list) {
        set.status = 404;
        return { message: 'Daftar kontak tidak ditemukan' };
      }

      const rawPhone = body.phoneNumber.replace(/[^\d+]/g, '');
      const [existing] = await db
        .select()
        .from(schema.contacts)
        .where(and(eq(schema.contacts.contactListId, params.id), eq(schema.contacts.phoneNumber, rawPhone)))
        .limit(1);

      if (existing) {
        return existing;
      }

      const [contact] = await db
        .insert(schema.contacts)
        .values({
          contactListId: params.id,
          phoneNumber: rawPhone,
          name: body.name ? body.name.trim() : null,
        })
        .returning();

      return contact;
    },
    {
      body: t.Object({
        phoneNumber: t.String({ minLength: 5 }),
        name: t.Optional(t.String()),
      }),
    },
  )
  // 6. Delete single contact
  .delete('/:id/contacts/:contactId', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [list] = await db
      .select()
      .from(schema.contactLists)
      .where(and(eq(schema.contactLists.id, params.id), eq(schema.contactLists.userId, user.id)))
      .limit(1);

    if (!list) {
      set.status = 404;
      return { message: 'Daftar kontak tidak ditemukan' };
    }

    await db
      .delete(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, params.contactId),
          eq(schema.contacts.contactListId, params.id),
        ),
      );

    return { success: true };
  })
  // 7. Import contacts from CSV
  .post(
    '/:id/import-csv',
    async ({ params, body, getAuthUser, set }) => {
      const user = await getAuthUser();
      const [list] = await db
        .select()
        .from(schema.contactLists)
        .where(and(eq(schema.contactLists.id, params.id), eq(schema.contactLists.userId, user.id)))
        .limit(1);

      if (!list) {
        set.status = 404;
        return { message: 'Daftar kontak tidak ditemukan' };
      }

      const file = body.file as File;
      if (!file) {
        set.status = 400;
        return { message: 'File CSV wajib disertakan' };
      }

      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

      const toInsert: Array<{ contactListId: string; phoneNumber: string; name: string | null }> = [];
      let startIndex = 0;

      // Check if first line is a header
      if (lines.length > 0 && /phone|nomor|hp|name|nama/i.test(lines[0])) {
        startIndex = 1;
      }

      const existingContacts = await db
        .select({ phoneNumber: schema.contacts.phoneNumber })
        .from(schema.contacts)
        .where(eq(schema.contacts.contactListId, params.id));
      const existingSet = new Set(existingContacts.map((c) => c.phoneNumber));
      const seenInCsv = new Set<string>();

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 1) {
          const rawPhone = parts[0].replace(/[^\d+]/g, '');
          const name = parts[1] || null;
          if (rawPhone.length >= 6 && !existingSet.has(rawPhone) && !seenInCsv.has(rawPhone)) {
            seenInCsv.add(rawPhone);
            toInsert.push({
              contactListId: params.id,
              phoneNumber: rawPhone,
              name,
            });
          }
        }
      }

      if (toInsert.length > 0) {
        // Chunk inserts by 500
        for (let i = 0; i < toInsert.length; i += 500) {
          await db.insert(schema.contacts).values(toInsert.slice(i, i + 500));
        }
      }

      return {
        imported: toInsert.length,
        total: lines.length - startIndex,
      };
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    },
  )
  // 8. Export contacts as CSV
  .get('/:id/export-csv', async ({ params, getAuthUser, set }) => {
    const user = await getAuthUser();
    const [list] = await db
      .select()
      .from(schema.contactLists)
      .where(and(eq(schema.contactLists.id, params.id), eq(schema.contactLists.userId, user.id)))
      .limit(1);

    if (!list) {
      set.status = 404;
      return { message: 'Daftar kontak tidak ditemukan' };
    }

    const contactsList = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.contactListId, params.id))
      .orderBy(schema.contacts.createdAt);

    const safeFilename = (list.name || 'contacts').replace(/[^a-zA-Z0-9_-]/g, '_');
    set.headers['Content-Type'] = 'text/csv; charset=utf-8';
    set.headers['Content-Disposition'] = `attachment; filename="${safeFilename}.csv"`;

    const header = 'Phone Number,Name\n';
    const rows = contactsList
      .map((c) => `"${c.phoneNumber}","${(c.name || '').replace(/"/g, '""')}"`)
      .join('\n');

    return header + rows;
  });
