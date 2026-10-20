import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const chatQuota=sqliteTable('chat_quota',{key:text('key').primaryKey(),used:integer('used').notNull(),expires:integer('expires').notNull()});
