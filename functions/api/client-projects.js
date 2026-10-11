import { requireAuth } from './auth.js';

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function handler({ env, clientId }) {
  // Get client details
  const client = await env.DB.prepare(
    'SELECT id, name, email, phone, business FROM clients WHERE id = ?'
  ).bind(clientId).first();

  if (!client) {
    return json({ success: false, message: "Client not found" }, 404);
  }

  // Get all projects for this client
  const projects = await env.DB.prepare(
    'SELECT id, name, package, status, created_at, updated_at FROM projects WHERE client_id = ? ORDER BY created_at DESC'
  ).bind(clientId).all();

  // For each project, get milestones and tasks
  const projectsWithDetails = await Promise.all(
    projects.results.map(async (project) => {
      const milestones = await env.DB.prepare(
        'SELECT id, name, status, due_date, completed_at FROM milestones WHERE project_id = ? ORDER BY created_at ASC'
      ).bind(project.id).all();

      const tasks = await env.DB.prepare(
        'SELECT id, name, description, status, due_date, completed_at, milestone_id FROM tasks WHERE project_id = ? ORDER BY created_at ASC'
      ).bind(project.id).all();

      return {
        ...project,
        milestones: milestones.results,
        tasks: tasks.results,
      };
    })
  );

  return json({
    success: true,
    client,
    projects: projectsWithDetails,
  });
}

export const onRequest = requireAuth(handler);
