<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Workflow

- After making requested code changes, stage, commit, push, and deploy to Vercel unless the user explicitly says not to.
- Always verify that the correct public production URL is updated after deploy.
- The canonical public URL for this project is `https://nicogymtracker.vercel.app/`.
- If a deploy creates or updates another Vercel alias, make sure `nicogymtracker.vercel.app` points to the latest intended production deployment.
