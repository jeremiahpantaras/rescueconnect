"""Tracking codes: the secret a citizen uses to check their own report (no account needed).

12 characters from Crockford's base32 alphabet (no I, L, O or U, so codes are easy to read out and
type) = 60 bits of randomness from `secrets`. Shown as XXXX-XXXX-XXXX. The code is the only
credential for the public status page, so it must never be derived from the report id.
"""
import re
import secrets

ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
CODE_LENGTH = 12

# Crockford: people mistype these, so accept them as their look-alikes.
_LOOKALIKES = str.maketrans({'O': '0', 'I': '1', 'L': '1'})


def generate_tracking_code():
    return ''.join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


def normalize_tracking_code(value):
    """Return the canonical 12-character code for user input, or None if it cannot be a code."""
    cleaned = re.sub(r'[\s-]', '', value or '').upper().translate(_LOOKALIKES)
    if len(cleaned) != CODE_LENGTH or any(char not in ALPHABET for char in cleaned):
        return None
    return cleaned


def format_tracking_code(code):
    """XXXX-XXXX-XXXX for display."""
    return '-'.join(code[i:i + 4] for i in range(0, len(code), 4))
