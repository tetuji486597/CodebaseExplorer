import { supabase } from '../db/supabase.js';
import { uploadFileContent } from '../db/fileStorage.js';

async function migrate() {
  const PAGE_SIZE = 100;
  let offset = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;

  console.log('Starting migration of file content to Storage...');

  while (true) {
    const { data: files, error } = await supabase
      .from('files')
      .select('id, project_id, path, content')
      .not('content', 'is', null)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Query error:', error.message);
      break;
    }

    if (!files || files.length === 0) break;

    for (const file of files) {
      try {
        await uploadFileContent(file.project_id, file.path, file.content);
        totalMigrated++;
        if (totalMigrated % 50 === 0) {
          console.log(`  Migrated ${totalMigrated} files...`);
        }
      } catch (err: any) {
        console.error(`  Failed: ${file.project_id}/${file.path} — ${err.message}`);
        totalSkipped++;
      }
    }

    offset += PAGE_SIZE;
  }

  console.log(`\nMigration complete: ${totalMigrated} files uploaded, ${totalSkipped} skipped.`);
}

migrate().catch(console.error);
