-- An amount changed by hand on the shopping list (#163). See docs/beslut/0027-mangd-for-hand.md.
-- An item with amount_edited stays when the list is made again, as one in the basket does, and
-- amount_before is what it had before, to put back and to show beside the new one.
ALTER TABLE shopping_item ADD COLUMN amount_edited INTEGER NOT NULL DEFAULT 0
	CHECK (amount_edited IN (0, 1));
ALTER TABLE shopping_item ADD COLUMN amount_before TEXT;
