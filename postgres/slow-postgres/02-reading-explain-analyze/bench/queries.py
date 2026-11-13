# The queries the timing scripts run, shared by warm.py and cold.py.
REPORT = """SELECT o.status, count(*) AS orders, sum(o.amount_cents) AS cents
FROM users u JOIN orders o ON o.user_id = u.id
WHERE u.country = 'PT' AND u.city = 'Lisbon'
GROUP BY o.status ORDER BY orders DESC"""
REPORT_CITY_ONLY = REPORT.replace("u.country = 'PT' AND ", '')
SORT_JOIN = """SELECT u.email, o.amount_cents
FROM orders o JOIN users u ON u.id = o.user_id
WHERE o.status = 'failed' ORDER BY o.amount_cents DESC"""
# name: (settings, query, time it plain too)
CASES = {
    'report':          ('', REPORT, True),
    'report_city_only': ('', REPORT_CITY_ONLY, True),
    'report_workmem_64mb': ("SET work_mem = '64MB';", REPORT, True),
    'sort_join_4mb':   ('', SORT_JOIN, False),  # plain would print 200,000 rows into the timing
    'sort_join_64mb':  ("SET work_mem = '64MB';", SORT_JOIN, False),
}
