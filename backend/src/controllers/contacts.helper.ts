import supabaseClient from '../utils/supabase';

async function deleteFromTable(
  table: string,
  emails?: string[]
): Promise<void> {
  if (emails === undefined) {
    const { error } = await supabaseClient
      .schema('private')
      .from(table)
      .delete()
      .neq('email', ''); // DELETE requires a WHERE clause

    if (error) {
      throw new Error(`Error deleting from ${table}: ${error.message}`);
    }
  } else if (emails) {
    const { error } = await supabaseClient
      .schema('private')
      .from(table)
      .delete()
      .in('email', emails);

    if (error) {
      throw new Error(`Error deleting from ${table}: ${error.message}`);
    }
  }
}

export async function deleteContactsFromDatabase(
  emails: string[],
  deleteAllContacts: boolean
): Promise<void> {
  if (deleteAllContacts) {
    await deleteFromTable('persons');
    await deleteFromTable('refinedpersons');
  } else if (emails) {
    await deleteFromTable('persons', emails);
    await deleteFromTable('refinedpersons', emails);
  }
}
