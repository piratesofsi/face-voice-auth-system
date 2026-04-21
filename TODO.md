# Dashboard Enhancement TODO
Approved plan: Charts/analytics (high), real-time SSE, search/filter, face gallery/notifications.

## Steps (to be checked off as completed):
- [x] 1. Create shared hooks/components: `src/hooks/useSSE.js`, `src/components/Charts.js`, `src/components/Search.js`
- [x] 2. Enhance UserDashboard: Add Settings sidebar item, quick stats chart, SSE real-time history
- [x] 3. Enhance AdminDashboard: Add Analytics sidebar, charts (logins pie/line, top users), search/filter tables, SSE updates
- [ ] 4. Add Face Gallery to Admin (new backend endpoint if needed: /admin/faces)
- [ ] 5. Add Notifications panels (derive from logs or new backend)
- [x] 6. Test frontend: `npm run dev`

- [ ] 7. Backend changes (SSE endpoint /admin/events)
- [ ] 8. Full test & attempt_completion

Current: Starting step 1.

