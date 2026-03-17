import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { fetchAllJobs, getSourceStats } from './services/jobService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

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

// POST /api/parse-resume — Pro Feature: Parse resume for keywords
app.post('/api/parse-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No resume file provided' });
        }

        console.log(`[${new Date().toISOString()}] POST /api/parse-resume — Extracting keywords`);
        
        const parser = new PDFParse({ data: req.file.buffer });
        const result = await parser.getText();
        await parser.destroy();

        const text = result.text.toLowerCase();

        // Common tech keywords to look for
        const techKeywords = [
            'react', 'node.js', 'node', 'python', 'java', 'aws', 'docker', 'kubernetes',
            'typescript', 'javascript', 'vue', 'angular', 'sql', 'mongodb', 'express',
            'django', 'flask', 'spring', 'go', 'rust', 'c++', 'c#', 'php', 'ruby',
            'html', 'css', 'tailwind', 'linux', 'git', 'ci/cd', 'agile', 'scrum',
            'redis', 'graphql', 'rest', 'api', 'machine learning', 'data science',
            'frontend', 'backend', 'full stack', 'devops', 'cloud', 'azure', 'gcp',
            'next.js', 'nest.js', 'graphql', 'postgres', 'mysql', 'docker', 'k8s'
        ];

        // Ensure we match whole words and escape special regex characters like +, *, ?, .
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const foundKeywords = techKeywords.filter(kw => {
            try {
                const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i');
                return regex.test(text);
            } catch (e) {
                console.error(`Regex error for keyword "${kw}":`, e);
                return false;
            }
        });

        // Deduplicate and filter out 'node' if 'node.js' is already there to avoid redundancy
        let finalKeywords = [...new Set(foundKeywords)];
        if (finalKeywords.includes('node.js') && finalKeywords.includes('node')) {
            finalKeywords = finalKeywords.filter(k => k !== 'node');
        }

        res.json({
            success: true,
            keywords: finalKeywords
        });
    } catch (err) {
        console.error('Error parsing resume:', err.stack || err);
        res.status(500).json({ success: false, error: 'Failed to parse resume: ' + err.message });
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
    res.json({ 
        status: 'ok', 
        version: '1.0.1-pro',
        timestamp: new Date().toISOString() 
    });
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
