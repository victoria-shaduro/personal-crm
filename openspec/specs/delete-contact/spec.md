# Contact deletion

## Requirements
- Delete is available on the contact card next to Edit, and is absent from the edit page.
- Confirmation names the contact and warns that the contact and all notes are permanently deleted.
- Cancel and Escape preserve the contact, notes, and any unsaved note draft. Initial focus is on Cancel.
- While pending, prevent closing and duplicate submissions.
- On failure keep the dialog open with an error and allow retry; missing contacts report not found.
- On success invalidate contact pages and the list, redirect to the unfiltered list, and show a one-time success notification.
- Existing cascading deletion removes all related notes without a schema migration.

## Acceptance
- Cancel, confirm, keyboard navigation, mobile layout and long names work.
- Deleted contacts disappear from search and counts; their view and edit URLs show not found.
- Related notes are removed; repeated deletion and database failures never show success.
