-- 039_task_files.sql
-- PDF, Word and Excel files in task descriptions and comments (lib/taskFiles.ts). They go in the
-- photos' bucket, in the same folder per task, so 032's access rules, the merge copy and the nightly
-- purge all cover them unchanged. This only widens what the bucket accepts: 10 MB (was 2 MB) and
-- the document types beside JPEG. Run after 032. Safe to re-run.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'task-photos';
