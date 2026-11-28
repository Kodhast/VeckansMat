-- The text an item had before it was changed by hand (#208), which "Som Claude skrev" puts back;
-- NULL while it is as Claude or the recipe wrote it. An item whose text is changed is changed by
-- hand like one whose amount is: it stays when the list is made again. See
-- docs/beslut/0027-mangd-for-hand.md.
ALTER TABLE shopping_item ADD COLUMN text_before TEXT;
