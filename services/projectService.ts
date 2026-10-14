import { ViewMode } from '../types';

export interface RecentProject {
  id: string;
  name: string;
  type: ViewMode;
  timestamp: number;
  fileName?: string;
  fileSize?: string;
  stateData?: any;
}

const RECENT_PROJECTS_KEY = 'genius_ai_recent_projects_v1';
const ACTIVE_PROJECT_ID_KEY = 'genius_ai_active_project_id_v1';

export const projectService = {
  getRecentProjects(): RecentProject[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(RECENT_PROJECTS_KEY);
      if (data) {
        const parsed = JSON.parse(data) as RecentProject[];
        // Sort by timestamp descending
        return parsed.sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch (e) {
      console.error('Failed to parse recent projects', e);
    }
    return [];
  },

  saveProject(params: {
    name: string;
    type: ViewMode;
    stateData: any;
    fileName?: string;
    fileSize?: string;
  }): RecentProject {
    const projects = this.getRecentProjects();
    
    // Look for an existing project of the same type or name to update or create new
    const existingIndex = projects.findIndex(
      p => p.type === params.type && (p.name === params.name || p.fileName === params.fileName)
    );

    const project: RecentProject = {
      id: existingIndex >= 0 ? projects[existingIndex].id : 'proj_' + Math.random().toString(36).substring(7),
      name: params.name,
      type: params.type,
      timestamp: Date.now(),
      fileName: params.fileName,
      fileSize: params.fileSize || 'N/A',
      stateData: params.stateData,
    };

    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    // Keep only the last 15 projects in localStorage to conserve space, but UI will show last 5
    const updated = projects
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);

    try {
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save projects to localStorage', e);
    }

    return project;
  },

  setActiveProject(projectId: string | null): void {
    if (typeof window === 'undefined') return;
    if (projectId === null) {
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    } else {
      localStorage.setItem(ACTIVE_PROJECT_ID_KEY, projectId);
    }
  },

  getActiveProject(): RecentProject | null {
    if (typeof window === 'undefined') return null;
    const activeId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
    if (!activeId) return null;

    const projects = this.getRecentProjects();
    const active = projects.find(p => p.id === activeId) || null;
    return active;
  },

  deleteProject(id: string): void {
    const projects = this.getRecentProjects();
    const filtered = projects.filter(p => p.id !== id);
    try {
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(filtered));
      const activeId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
      if (activeId === id) {
        localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
      }
    } catch (e) {
      console.error('Failed to delete project', e);
    }
  }
};
