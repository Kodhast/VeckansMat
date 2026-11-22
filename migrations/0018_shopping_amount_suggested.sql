-- What Claude counts now for an item whose amount was changed by hand, once its dishes have changed
-- (#197). See docs/beslut/0027-mangd-for-hand.md. amount_change says how the dishes changed: a dish
-- added, one removed, or both; the household then keeps its amount or takes Claude's.
ALTER TABLE shopping_item ADD COLUMN amount_suggested TEXT;
ALTER TABLE shopping_item ADD COLUMN amount_change TEXT
	CHECK (amount_change IN ('added', 'removed', 'changed'));
