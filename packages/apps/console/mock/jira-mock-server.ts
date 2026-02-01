// Mock Jira API Server
// Run with: tsx mock/jira-mock-server.ts
import express, { type Request, Response } from "express";
import { createServer } from "http";

const app = express();
const PORT = process.env.MOCK_JIRA_PORT || 3001;

app.use(express.json());

// CORS support (optional, for direct frontend access)
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

// Helper to generate mock issues with various states
function generateMockIssues(count: number, includeStale: boolean = true) {
  const now = new Date();
  const issues = [];
  
  const statuses = ["To Do", "In Progress", "In Review", "Done"];
  const priorities = ["Lowest", "Low", "Medium", "High", "Highest"];
  const projects = ["PROJ", "DEV", "OPS", "BUG"];
  
  for (let i = 0; i < count; i++) {
    const project = projects[i % projects.length];
    const key = `${project}-${1000 + i}`;
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];
    
    // Generate updated date - some stale (8+ days ago), some recent
    let updatedDate: Date;
    if (includeStale && i % 3 === 0 && status !== "Done") {
      // Stale tickets: 8-14 days ago
      updatedDate = new Date(now);
      updatedDate.setDate(updatedDate.getDate() - (8 + (i % 7)));
    } else {
      // Recent tickets: 0-6 days ago
      updatedDate = new Date(now);
      updatedDate.setDate(updatedDate.getDate() - (i % 7));
    }
    
    // Generate comments - some tickets have comments, some don't
    // Tickets with comments are more likely to be waiting on user input
    const hasComments = i % 2 === 0; // 50% have comments
    const commentCount = hasComments ? Math.floor(Math.random() * 5) + 1 : 0;
    const comments = hasComments ? Array.from({ length: commentCount }, (_, idx) => {
      const commentDate = new Date(updatedDate);
      commentDate.setDate(commentDate.getDate() - (commentCount - idx));
      return {
        id: `${i}-${idx}`,
        author: {
          displayName: `User ${idx}`,
          accountId: `user${idx}`,
        },
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `Comment ${idx + 1} on ${key}`,
                },
              ],
            },
          ],
        },
        created: commentDate.toISOString(),
        updated: commentDate.toISOString(),
      };
    }) : [];
    
    issues.push({
      expand: "",
      id: `1000${i}`,
      self: `https://mock-jira.atlassian.net/rest/api/3/issue/${key}`,
      key,
      fields: {
        summary: `Mock Issue ${i + 1}: ${status} task with ${priority} priority`,
        priority: {
          self: `https://mock-jira.atlassian.net/rest/api/3/priority/${i % 5}`,
          iconUrl: `https://mock-jira.atlassian.net/images/icons/priorities/${priority.toLowerCase()}.svg`,
          name: priority,
          id: `${i % 5}`
        },
        status: {
          self: `https://mock-jira.atlassian.net/rest/api/3/status/${i % 4}`,
          description: status,
          iconUrl: `https://mock-jira.atlassian.net/images/icons/statuses/${status.toLowerCase().replace(' ', '')}.png`,
          name: status,
          id: `${i % 4}`,
          statusCategory: {
            self: `https://mock-jira.atlassian.net/rest/api/3/statuscategory/${i % 3}`,
            id: i % 3,
            key: status === "Done" ? "done" : "indeterminate",
            colorName: status === "Done" ? "green" : "yellow",
            name: status === "Done" ? "Done" : "In Progress"
          }
        },
        assignee: i % 2 === 0 ? {
          self: `https://mock-jira.atlassian.net/rest/api/3/user?accountId=user${i}`,
          accountId: `user${i}`,
          emailAddress: `user${i}@example.com`,
          avatarUrls: {
            "48x48": `https://avatar.example.com/user${i}.png`,
            "24x24": `https://avatar.example.com/user${i}.png`,
            "16x16": `https://avatar.example.com/user${i}.png`,
            "32x32": `https://avatar.example.com/user${i}.png`
          },
          displayName: `User ${i}`,
          active: true,
          timeZone: "America/New_York"
        } : null,
        updated: updatedDate.toISOString(),
        created: new Date(updatedDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        comment: {
          comments,
          maxResults: commentCount,
          total: commentCount,
        }
      }
    });
  }
  
  return issues;
}

// GET /rest/api/3/search - Search issues
app.get("/rest/api/3/search", (req: Request, res: Response) => {
  // Decode URL-encoded JQL parameter
  const jql = decodeURIComponent((req.query.jql as string) || "");
  const maxResults = parseInt((req.query.maxResults as string) || "50", 10);
  const fields = ((req.query.fields as string) || "").split(",");
  
  // Check Basic Auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return res.status(401).json({
      errorMessages: ["Authentication required"],
      errors: {}
    });
  }
  
  console.log(`[MOCK JIRA] Search request: jql="${jql}", maxResults=${maxResults}`);
  
  // Generate mock issues
  const allIssues = generateMockIssues(20, true);
  
  // Filter based on JQL if provided (simple parsing)
  let filteredIssues = allIssues;
  if (jql && jql.includes("updated >=")) {
    // Extract date from JQL (handles both encoded and decoded formats)
    const dateMatch = jql.match(/updated\s*>=\s*"([^"]+)"/);
    if (dateMatch) {
      const sinceDate = new Date(dateMatch[1]);
      if (!isNaN(sinceDate.getTime())) {
        filteredIssues = allIssues.filter(issue => 
          new Date(issue.fields.updated) >= sinceDate
        );
      }
    }
  }
  
  // Limit results
  const issues = filteredIssues.slice(0, maxResults);
  
  res.json({
    expand: "names,schema",
    startAt: 0,
    maxResults: issues.length,
    total: filteredIssues.length,
    issues
  });
});

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "mock-jira-api" });
});

// Start server
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`🚀 Mock Jira API Server running on http://localhost:${PORT}`);
  console.log(`   Endpoint: http://localhost:${PORT}/rest/api/3/search`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`\n   Use Basic Auth with any credentials (e.g., user:token)`);
  console.log(`   Set JIRA_HOST=http://localhost:${PORT} in your .env`);
});

