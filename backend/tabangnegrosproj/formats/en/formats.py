"""RescueConnect date and time formats: the whole system uses the 12-hour clock with AM/PM, never 24-hour.

Django picks these up for the 'en' locale (settings.FORMAT_MODULE_PATH), so the admin, templates and form
inputs all follow them. Do not hard-code 'H:i' / 'G:i' / '%H' anywhere; use these formats or 'g:i A'.
"""

DATE_FORMAT = 'F j, Y'
TIME_FORMAT = 'g:i A'                  # 10:15 PM
DATETIME_FORMAT = 'N j, Y, g:i A'      # Oct. 25, 2026, 10:15 PM
SHORT_DATE_FORMAT = 'm/d/Y'
SHORT_DATETIME_FORMAT = 'm/d/Y g:i A'  # 10/25/2026 10:15 PM

# What the admin's time/date-time inputs show and accept (first entry is the one displayed).
TIME_INPUT_FORMATS = [
    '%I:%M:%S %p',  # 10:15:00 PM
    '%I:%M %p',     # 10:15 PM
    '%H:%M:%S',     # still accepted when typed, e.g. 22:15:00
    '%H:%M',
]
DATETIME_INPUT_FORMATS = [
    '%Y-%m-%d %I:%M:%S %p',
    '%Y-%m-%d %I:%M %p',
    '%Y-%m-%d %H:%M:%S',
    '%Y-%m-%d %H:%M',
    '%m/%d/%Y %I:%M:%S %p',
    '%m/%d/%Y %I:%M %p',
    '%m/%d/%Y %H:%M:%S',
    '%m/%d/%Y %H:%M',
]
