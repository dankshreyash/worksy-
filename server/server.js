import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fetchAllJobs, getSourceStats } from './services/jobService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// ROUTES
// ============================================

// GET /api/jobs — Fetch aggregated live jobs
app.get('/api/jobs', async (req, res) => {
    try {
        const { search, limit } = req.query;
        console.log(`[${new Date().toISOString()}] GET /api/jobs — search: "${search || ''}", limit: ${limit || 'all'}`);

        const jobs = await fetchAllJobs({ search, limit: parseInt(limit) || 50 });

        res.json({
            success: true,
            count: jobs.length,
            source: 'live',
            jobs,
        });
    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
    }
});

// GET /api/sources — List active job sources
app.get('/api/sources', (req, res) => {
    res.json(getSourceStats());
});

// GET /api/applications — Fetch current application state
// For now, these are just mocked but this endpoint is ready for persistence
app.get('/api/applications', (req, res) => {
    res.json({ success: true, count: 0, applications: [] });
});

// POST /api/apply — Trigger automated application
app.post('/api/apply', async (req, res) => {
    try {
        const { job, user } = req.body;
        console.log(`[${new Date().toISOString()}] POST /api/apply — job: "${job.title}" at "${job.company.name}"`);

        // Simulate automation process
        // 1. Check if user has resume
        // 2. Map fields
        // 3. Submit

        // Return immediate "Processing" status
        res.json({
            success: true,
            status: 'processing',
            message: `Started automated application for ${job.title} at ${job.company.name}`,
            jobId: job.id,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Error in /api/apply:', err);
        res.status(500).json({ success: false, error: 'Failed to trigger automation' });
    }
});

// GET /api/proxy-image — Proxy external images to bypass CORS/NotSameOrigin
app.get('/api/proxy-image', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send('URL is required');

        // Advanced stealth headers to bypass 403 Forbidden
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'Referer': 'https://www.google.com/'
            }
        });

        if (!response.ok) {
            console.error(`Proxy Failed for ${url}: ${response.status}`);
            return res.status(response.status).send('Failed to fetch image');
        }

        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error('Error proxying image:', err.message);
        res.status(500).send('Error proxying image');
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// START
// ============================================
app.listen(PORT, () => {
    console.log(`  🚀 Worksy API Server running at http://localhost:${PORT}`);
    console.log(`  📡 Job sources: 20 platforms (Remotive, Himalayas, Jobicy, RemoteOK, WWR, LinkedIn, Indeed, Naukri, Wellfound, Cutshort, Instahyre, Hirist, Otta, FlexJobs, Cognizant, TCS, Infosys, HCL, Wipro, + 400 Indian IT Masters)`);
    console.log(`  🔗 Endpoints:`);
    console.log(`     GET /api/jobs       — Fetch aggregated jobs`);
    console.log(`     GET /api/jobs?search=react — Search jobs`);
    console.log(`     GET /api/sources    — List sources`);
    console.log(`     GET /api/health     — Health check\n`);
});
