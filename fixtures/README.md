# Fixtures

Redacted booking emails used as the extractor eval set. Each fixture is a pair:

- `NNN-slug.eml` — the raw message, with names, addresses and references replaced
- `NNN-slug.expected.json` — the fields the extractor must produce

The extractor can't regress against this set. Target: 20+ fixtures covering
new bookings, option-to-confirmed updates, call time changes, travel, and payment.
