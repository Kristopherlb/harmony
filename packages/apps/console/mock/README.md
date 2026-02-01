# Jira Mock API

This directory contains tools for mocking the Jira API for local development and testing.

## Options

1. **Standalone Mock Server** (Recommended) - Express-based mock server
2. **Postman Mock Server** - Use Postman's built-in mock server feature

---

## Option 1: Standalone Mock Server

### Quick Start

1. **Start the mock server:**
   ```bash
   tsx mock/jira-mock-server.ts
   ```

   Or add to `package.json`:
   ```json
   {
     "scripts": {
       "mock:jira": "tsx mock/jira-mock-server.ts"
     }
   }
   ```

2. **Configure your app:**
   Set these environment variables:
   ```bash
   JIRA_HOST=http://localhost:3001
   JIRA_EMAIL=user
   JIRA_API_TOKEN=token
   ```

3. **Test the mock server:**
   ```bash
   curl -u user:token http://localhost:3001/rest/api/3/search?jql=updated%20%3E%3D%20%222024-01-01%22&maxResults=10&fields=summary,priority,status,assignee,updated
   ```

### Features

- ✅ Generates realistic mock Jira issues
- ✅ Includes stale tickets (8+ days old) for testing stale ticket detection
- ✅ Supports JQL filtering (basic `updated >=` queries)
- ✅ Basic Auth authentication (accepts any credentials)
- ✅ Matches Jira API v3 response format
- ✅ Health check endpoint at `/health`

### Mock Data

The server generates 20 mock issues with:
- Various statuses: "To Do", "In Progress", "In Review", "Done"
- Different priorities: "Lowest", "Low", "Medium", "High", "Highest"
- Multiple projects: "PROJ", "DEV", "OPS", "BUG"
- Mix of stale (8-14 days old) and recent (0-6 days old) tickets
- Some assigned, some unassigned

### Customization

You can modify `generateMockIssues()` in `jira-mock-server.ts` to:
- Change the number of issues
- Adjust stale ticket thresholds
- Add more projects/statuses/priorities
- Customize assignee data

---

## Option 2: Postman Mock Server

### Setup

1. **Import the collection:**
   - Open Postman
   - Click "Import"
   - Select `mock/postman-jira-mock.json`

2. **Create a Mock Server:**
   - In Postman, go to the "Jira Mock API" collection
   - Click the three dots (...) → "Add Mock Server"
   - Configure:
     - **Environment:** Create new or use existing
     - **Mock Server Name:** "Jira Mock API"
     - **Make mock server private:** (optional)
   - Click "Create Mock Server"
   - **Copy the mock server URL** (e.g., `https://xxxx-xxxx-xxxx.mock.pstmn.io`)

3. **Configure your app:**
   ```bash
   JIRA_HOST=https://xxxx-xxxx-xxxx.mock.pstmn.io
   JIRA_EMAIL=user
   JIRA_API_TOKEN=token
   ```

4. **Set collection variables:**
   - In Postman, go to the collection
   - Click "Variables" tab
   - Update `jira_host` to your mock server URL
   - Update `auth_token` to your Base64 encoded `user:token`

### Using the Mock Server

1. **Send requests:**
   - Use the "Search Issues" request in the collection
   - The mock server will return the example response

2. **Customize responses:**
   - Edit the example response in the collection
   - Add more example responses for different scenarios
   - Use Postman's dynamic variables for realistic data

### Postman Mock Server Limitations

- Requires Postman account (free tier works)
- Mock server URL changes if you recreate it
- Less flexible than standalone server for dynamic responses
- Requires internet connection

---

## Testing Stale Tickets

Both mock servers include stale tickets (updated 8+ days ago) to test the stale ticket detection feature:

- **Stale tickets:** Issues with status "In Progress", "In Review", or "To Do" that haven't been updated in 7+ days
- **Recent tickets:** Issues updated within the last 7 days

The standalone mock server generates tickets with:
- ~33% stale tickets (8-14 days old)
- ~67% recent tickets (0-6 days old)

---

## Troubleshooting

### Mock Server Not Starting

- Check if port 3001 is already in use:
  ```bash
  lsof -i :3001
  ```
- Use a different port:
  ```bash
  MOCK_JIRA_PORT=3002 tsx mock/jira-mock-server.ts
  ```

### Authentication Errors

- Ensure Basic Auth header is set correctly
- Format: `Authorization: Basic <base64(user:token)>`
- Example: `Authorization: Basic dXNlcjp0b2tlbg==` (user:token)

### No Stale Tickets Showing

- Check the `updated` date in mock responses
- Ensure tickets are in "In Progress", "In Review", or "To Do" status
- Verify the stale threshold is 7 days in your app

---

## Next Steps

1. **Add more endpoints:** Extend the mock server with additional Jira API endpoints as needed
2. **Webhook simulation:** Add webhook endpoints to simulate Jira webhook events
3. **Dynamic responses:** Enhance the mock server to respond differently based on query parameters
4. **Integration tests:** Use the mock server in your test suite

