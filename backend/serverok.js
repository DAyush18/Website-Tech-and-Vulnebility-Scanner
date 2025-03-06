require("dotenv").config();
const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ✅ Initialize Gemini AI API
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// ✅ Function to Scrape Website Data
async function scrapeWebsite(url) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    try {
        await page.goto(`https://w3techs.com/sites/info/${url}`, { waitUntil: "domcontentloaded" });

        // ✅ Check if the page loaded correctly by looking for the technology section
        const isPageValid = await page.$(".tech_main");
        if (!isPageValid) {
            console.error("❌ Page structure not found. W3Techs might have changed.");
            await browser.close();
            return null;
        }

        await browser.close();
        return { website: url };
    } catch (error) {
        console.error("❌ Scraping Error:", error);
        await browser.close();
        return null;
    }
}

// ✅ Function to Analyze Data with Gemini AI
async function analyzeWithGemini(websiteData) {
    try {
        console.log("🔍 Sending data to Gemini:", JSON.stringify(websiteData, null, 2));

        const inputText = ` first clear or make the input data clear and precise and show it in proper format
        
        // what are the security vulnerabilities for the following website and provide detailed information on :
        // describe each point brefily and also show what input you are using from w3tech on which basis you are giving output
        // - Where the vulnerability is present in a given website 
        // - What the vulnerability is
        // - How it can be exploited using tools
        // - Solution to fix it
        
        Website Data:
        ${JSON.stringify(websiteData, null, 2)}`;

        const chatSession = model.startChat({
            generationConfig: {
                temperature: 1,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
            },
        });

        const result = await chatSession.sendMessage(inputText);
        console.log("✅ Gemini Response:", result.response.text());
        return result.response.text();
    } catch (error) {
        console.error("❌ Gemini API Error:", error);
        return "Error analyzing vulnerabilities with Google Gemini.";
    }
}

// ✅ API Endpoint
app.post("/analyze", async (req, res) => {
    const { website } = req.body;
    if (!website) return res.status(400).json({ error: "Website URL is required" });

    console.log(`🔍 Processing: ${website}`);

    const scrapedData = await scrapeWebsite(website);
    if (!scrapedData) return res.status(500).json({ error: "Error scraping website data" });

    const vulnerabilities = await analyzeWithGemini(scrapedData);

    res.json({
        website,
        vulnerabilities,
    });
});

// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
