// --- Data Management & State ---
    const state = {
        birth: { d: 0, m: 0, y: 0 },
        results: { y: 0, m: 0, d: 0, total: 0, countdown: 0 },
        isChartInitialized: false,
        aiUnlocked: false,
        activeTab: 'report', // 'report', 'sage', or 'sigil'
        reportCache: null,
        sigilCache: null
    };

    // --- DOM Elements ---
    const form = document.getElementById('age-form');
    const inputs = {
        d: document.getElementById('input-day'),
        m: document.getElementById('input-month'),
        y: document.getElementById('input-year')
    };
    const errors = {
        d: document.getElementById('err-day'),
        m: document.getElementById('err-month'),
        y: document.getElementById('err-year')
    };
    const outputs = {
        y: document.getElementById('res-years'),
        m: document.getElementById('res-months'),
        d: document.getElementById('res-days'),
        total: document.getElementById('res-total-days'),
        next: document.getElementById('res-next-bday')
    };
    const vizElements = {
        nominal: document.getElementById('viz-nominal'),
        adjust: document.getElementById('viz-adjust'),
        final: document.getElementById('viz-final')
    };

    // AI UI elements
    const aiLocked = document.getElementById('ai-locked');
    const aiUnlocked = document.getElementById('ai-unlocked');
    const aiGenerateBtn = document.getElementById('ai-generate-btn');
    const reportLoader = document.getElementById('report-loader');
    const reportError = document.getElementById('report-error');
    const reportErrorMsg = document.getElementById('report-error-msg');
    const reportRetryBtn = document.getElementById('report-retry-btn');
    const reportOutputCard = document.getElementById('report-output-card');
    const reportMarkdownContent = document.getElementById('report-markdown-content');
    const loadingBirthYear = document.getElementById('loading-birth-year');
    
    // AI Chat UI elements
    const tabBtnReport = document.getElementById('tab-btn-report');
    const tabBtnSage = document.getElementById('tab-btn-sage');
    const tabBtnSigil = document.getElementById('tab-btn-sigil');
    const aiContentReport = document.getElementById('ai-content-report');
    const aiContentSage = document.getElementById('ai-content-sage');
    const aiContentSigil = document.getElementById('ai-content-sigil');
    const chatMessages = document.getElementById('chat-messages');
    const chatUserInput = document.getElementById('chat-user-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatOriginDate = document.getElementById('chat-origin-date');
    const chatCurrentAge = document.getElementById('chat-current-age');
    const sageTyping = document.getElementById('sage-typing');

    // AI Sigil UI elements
    const aiSigilBtn = document.getElementById('ai-sigil-btn');
    const sigilLoader = document.getElementById('sigil-loader');
    const sigilError = document.getElementById('sigil-error');
    const sigilErrorMsg = document.getElementById('sigil-error-msg');
    const sigilOutputCard = document.getElementById('sigil-output-card');
    const sigilImg = document.getElementById('sigil-img');
    const sigilPlaceholder = document.getElementById('sigil-placeholder');
    const loadingSigilYear = document.getElementById('loading-sigil-year');

    // Local Voice State
    let currentlySpeakingAudio = null;

    // --- Logic Implementation ---

    function validate() {
        let valid = true;
        const today = new Date();
        const curY = today.getFullYear();

        Object.keys(inputs).forEach(key => {
            const val = inputs[key].value.trim();
            inputs[key].classList.remove('input-error');
            errors[key].style.opacity = '0';
            
            if (!val) {
                showError(key, "This field is required");
                valid = false;
            }
        });

        if (!valid) return false;

        const d = parseInt(inputs.d.value);
        const m = parseInt(inputs.m.value);
        const y = parseInt(inputs.y.value);

        if (d < 1 || d > 31) { showError('d', "Must be a valid day"); valid = false; }
        if (m < 1 || m > 12) { showError('m', "Must be a valid month"); valid = false; }
        if (y < 1) { showError('y', "Must be a valid year"); valid = false; }
        else if (y > curY) { showError('y', "Must be in the past"); valid = false; }

        if (valid) {
            const birthDate = new Date(y, m - 1, d);
            const testDate = new Date(y, m - 1, d);
            
            // Check for invalid calendar dates (e.g. Feb 30)
            if (testDate.getMonth() + 1 !== m) {
                showError('d', "Must be a valid date");
                valid = false;
            } else if (birthDate > today) {
                showError('y', "Must be in the past");
                valid = false;
            }
        }

        return valid;
    }

    function showError(key, msg) {
        inputs[key].classList.add('input-error');
        errors[key].textContent = msg;
        errors[key].style.opacity = '1';
    }

    function calculate() {
        const d = parseInt(inputs.d.value);
        const m = parseInt(inputs.m.value);
        const y = parseInt(inputs.y.value);

        state.birth = { d, m, y };

        const today = new Date();
        let diffY = today.getFullYear() - y;
        let diffM = today.getMonth() - (m - 1);
        let diffD = today.getDate() - d;

        vizElements.nominal.textContent = `${diffY}y, ${diffM}m, ${diffD}d`;

        // Underflow mitigation
        let adjustmentMsg = "None Required";
        if (diffD < 0) {
            diffM--;
            const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
            diffD += daysInPrevMonth;
            adjustmentMsg = `Day Underflow (-${daysInPrevMonth})`;
        }

        if (diffM < 0) {
            diffY--;
            diffM += 12;
            adjustmentMsg = diffD < 0 ? "Dual Underflow (M/D)" : "Month Underflow (-12)";
        }

        vizElements.adjust.textContent = adjustmentMsg;
        vizElements.final.textContent = `${diffY}y ${diffM}m ${diffD}d`;

        // Total Lifetime Days (UTC for precision)
        const birthUTC = Date.UTC(y, m - 1, d);
        const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const totalDays = Math.floor((todayUTC - birthUTC) / 86400000);

        // Next Birthday Countdown
        let nextBday = new Date(today.getFullYear(), m - 1, d);
        if (nextBday < today) {
            nextBday.setFullYear(today.getFullYear() + 1);
        }
        const countdown = Math.ceil((nextBday - today) / 86400000);

        state.results = { y: diffY, m: diffM, d: diffD, total: totalDays, next: countdown };
        updateUI();
        unlockAISuite();
    }

    function updateUI() {
        animateValue(outputs.y, state.results.y);
        animateValue(outputs.m, state.results.m);
        animateValue(outputs.d, state.results.d);
        animateValue(outputs.total, state.results.total);
        animateValue(outputs.next, state.results.next);
    }

    // Performance-optimized animation using requestAnimationFrame
    function animateValue(obj, end, duration = 1000) {
        let startTimestamp = null;
        const startValue = 0;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 4); // easeOutQuart
            obj.innerHTML = Math.floor(easedProgress * (end - startValue) + startValue);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // --- Gemini API Call Helper with Exponential Backoff ---
    async function callGeminiAPI(systemPrompt, userQuery) {
        const apiKey = ""; // Implicitly injected at runtime
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        let delay = 1000;
        for (let i = 0; i < 5; i++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        return text;
                    }
                }
            } catch (err) {
                // Silently pass, retry backoff takes care of it
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
        throw new Error("Unable to establish communication with Chronos Temporal Core. Check network or try later.");
    }

    // --- Gemini TTS API Integration with PCM16 conversion ---
    async function callGeminiTTS(textToSpeak) {
        const apiKey = ""; // Injected at runtime
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: textToSpeak }] }],
            generationConfig: { 
                responseModalities: ["AUDIO"], 
                speechConfig: { 
                    voiceConfig: { 
                        prebuiltVoiceConfig: { 
                            voiceName: "Iapetus" // Deep, ancient cosmic voice perfect for Chronos Sage
                        } 
                    } 
                } 
            }
        };

        let delay = 1000;
        for (let i = 0; i < 5; i++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    const part = result.candidates?.[0]?.content?.parts?.[0];
                    const base64Audio = part?.inlineData?.data;
                    const mimeType = part?.inlineData?.mimeType || "audio/L16;rate=24000";
                    
                    if (base64Audio) {
                        let sampleRate = 24000;
                        const match = mimeType.match(/rate=(\d+)/);
                        if (match) {
                            sampleRate = parseInt(match[1], 10);
                        }
                        return pcmToWav(base64Audio, sampleRate);
                    }
                }
            } catch (err) {
                // Retry automatically
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
        throw new Error("Audio synthesis failed.");
    }

    // Convert PCM-16 bit base64 payload into robust wave format for browser playbacks
    function pcmToWav(pcmBase64, sampleRate) {
        const binaryString = window.atob(pcmBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const wavHeader = new ArrayBuffer(44);
        const wavView = new DataView(wavHeader);
        
        // "RIFF"
        wavView.setUint32(0, 0x52494646, false);
        // file length - 8
        wavView.setUint32(4, 36 + len, true);
        // "WAVE"
        wavView.setUint32(8, 0x57415645, false);
        // "fmt " chunk
        wavView.setUint32(12, 0x666d7420, false);
        // chunk length (16)
        wavView.setUint32(16, 16, true);
        // sample format (raw PCM = 1)
        wavView.setUint16(20, 1, true);
        // channel count (Mono = 1)
        wavView.setUint16(22, 1, true);
        // sample rate
        wavView.setUint32(24, sampleRate, true);
        // byte rate (sample rate * block align)
        wavView.setUint32(28, sampleRate * 2, true);
        // block align (channel count * bytes per sample)
        wavView.setUint16(32, 2, true);
        // bits per sample (16)
        wavView.setUint16(34, 16, true);
        // "data" chunk header
        wavView.setUint32(36, 0x64617461, false);
        // chunk length
        wavView.setUint32(40, len, true);
        
        const blob = new Blob([wavHeader, bytes], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    }

    // --- Imagen-4 Picture Crest Generator ---
    async function generateCosmicSigil() {
        if (state.sigilCache) {
            displaySigil(state.sigilCache);
            return;
        }

        sigilLoader.classList.remove('hidden');
        sigilError.classList.add('hidden');
        sigilOutputCard.classList.add('hidden');
        aiSigilBtn.disabled = true;

        loadingSigilYear.textContent = state.birth.y;

        const apiKey = ""; // Injected at runtime
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
        
        const promptText = `A futuristic mystical circular temporal sigil, sacred geometry layout of orbits, glowing vector traces, deep blue, gold and violet luminescent paths on deep starfield background, reflecting cosmic alignments of birth year ${state.birth.y}. Beautiful high-resolution detailed graphic design element.`;

        const payload = {
            instances: { prompt: promptText },
            parameters: { sampleCount: 1 }
        };

        let delay = 1000;
        for (let i = 0; i < 5; i++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    const base64 = result.predictions?.[0]?.bytesBase64Encoded;
                    if (base64) {
                        const finalUrl = `data:image/png;base64,${base64}`;
                        state.sigilCache = finalUrl;
                        displaySigil(finalUrl);
                        return;
                    }
                }
            } catch (err) {
                // Retry
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }

        // Show error after 5 failed attempts
        sigilErrorMsg.textContent = "Astronomical visual sync failed. Check network link and retry.";
        sigilError.classList.remove('hidden');
        sigilLoader.classList.add('hidden');
        aiSigilBtn.disabled = false;
    }

    function displaySigil(imgDataUrl) {
        sigilImg.src = imgDataUrl;
        sigilImg.classList.remove('hidden');
        sigilPlaceholder.classList.add('hidden');
        sigilOutputCard.classList.remove('hidden');
        sigilLoader.classList.add('hidden');
        aiSigilBtn.disabled = false;
    }

    // Custom lightweight markdown structural helper for rendering safe HTML
    function formatMarkdownToHTML(text) {
        // Sanitize generic tags just to be safe
        let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        // Headers
        html = html.replace(/^### (.*?)$/gm, '<h4 class="text-md font-bold text-indigo-700 mt-4 mb-2">$1</h4>');
        html = html.replace(/^## (.*?)$/gm, '<h3 class="text-lg font-extrabold text-indigo-900 mt-5 mb-3 border-b pb-1">$1</h3>');
        html = html.replace(/^# (.*?)$/gm, '<h2 class="text-xl font-black text-indigo-900 mt-6 mb-4">$1</h2>');
        
        // Bold & Italics
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Bullet Lists
        html = html.replace(/^\- (.*?)$/gm, '<li class="ml-4 list-disc text-sm text-gray-700">$1</li>');
        
        // Paragraph conversion
        html = html.replace(/\n\n/g, '</p><p class="text-sm text-gray-700 my-2">');
        html = html.replace(/\n/g, '<br>');
        
        return `<p class="text-sm text-gray-700 my-2">${html}</p>`;
    }

    // --- AI Suite Management ---
    function unlockAISuite() {
        state.aiUnlocked = true;
        state.reportCache = null; // Clear old reports on re-calculation
        state.sigilCache = null; // Clear old sigils
        aiLocked.classList.add('hidden');
        aiUnlocked.classList.remove('hidden');

        // Populate initial dates in UI
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${months[state.birth.m - 1]} ${state.birth.d}, ${state.birth.y}`;
        chatOriginDate.textContent = formattedDate;
        chatCurrentAge.textContent = `${state.results.y} years, ${state.results.m} months, and ${state.results.d} days`;
        
        // Reset output containers
        reportOutputCard.classList.add('hidden');
        reportMarkdownContent.innerHTML = "";
        reportError.classList.add('hidden');

        sigilOutputCard.classList.add('hidden');
        sigilImg.classList.add('hidden');
        sigilPlaceholder.classList.remove('hidden');
        sigilError.classList.add('hidden');
        
        // Clear old custom chat history except the system greeting
        const items = Array.from(chatMessages.children);
        items.forEach((item, index) => {
            if (index > 0) item.remove();
        });
    }

    async function generateTemporalReport() {
        if (state.reportCache) {
            displayReport(state.reportCache);
            return;
        }

        reportLoader.classList.remove('hidden');
        reportError.classList.add('hidden');
        reportOutputCard.classList.add('hidden');
        aiGenerateBtn.disabled = true;
        
        loadingBirthYear.textContent = state.birth.y;

        const systemPrompt = "You are Chronos AI, an elite archivist of human history and cosmological orbits. Present your findings directly in a neat structure. Keep explanations captivating, factual, and deeply personalized based on the input.";
        const userQuery = `Construct a chronological report for a user born on ${state.birth.y}-${state.birth.m}-${state.birth.d} who has lived for exactly ${state.results.y} Years, ${state.results.m} Months, and ${state.results.d} Days. Include three concise portions:
1. 🌍 HISTORICAL VIBE: Characterize the major technological and cultural milestones of the year ${state.birth.y} relative to today.
2. ✨ COSMIC MILEAGE: Provide creative estimations of cosmic stats (e.g. Earth's distance traveled during these years around the galactic center or orbits of outer planets).
3. 🔮 LIFE STREAM BLUEPRINT: Give an inspirational perspective on their milestone age (${state.results.y}) with thoughtful advice on human presence. Ensure formatting matches clean nested lists and distinct bold labels.`;

        try {
            const aiText = await callGeminiAPI(systemPrompt, userQuery);
            state.reportCache = aiText;
            displayReport(aiText);
        } catch (error) {
            reportErrorMsg.textContent = error.message || "We encountered a rift in the timeline. Please retry.";
            reportError.classList.remove('hidden');
        } finally {
            reportLoader.classList.add('hidden');
            aiGenerateBtn.disabled = false;
        }
    }

    function displayReport(markdownText) {
        reportMarkdownContent.innerHTML = formatMarkdownToHTML(markdownText);
        reportOutputCard.classList.remove('hidden');
    }

    async function sendMessageToSage() {
        const query = chatUserInput.value.trim();
        if (!query) return;

        // Append User Message to UI
        appendChatMessage('User', query, true);
        chatUserInput.value = "";

        sageTyping.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const systemPrompt = `You are the Chronos Sage, a warm, mysterious entity who has watched millennia drift by. The user you are addressing entered the timeline on birth year: ${state.birth.y}-${state.birth.m}-${state.birth.d} and is currently ${state.results.y} years old. Relate your cosmic perspective back to their specific timeframe when meaningful. Keep responses highly compelling, direct, and under 100 words. Do not use markdown bullet lists, keep text in paragraph sentences only.`;

        try {
            const reply = await callGeminiAPI(systemPrompt, query);
            appendChatMessage('Sage', reply, false);
        } catch (error) {
            appendChatMessage('Sage', "My cosmic link has momentarily lapsed. Let us re-synchronize.", false);
        } finally {
            sageTyping.classList.add('hidden');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Trigger Speech synthesis when playing specific bubble
    async function playSageAudio(text, btnElement) {
        if (currentlySpeakingAudio) {
            currentlySpeakingAudio.pause();
            currentlySpeakingAudio = null;
        }

        btnElement.textContent = "⏳ Synthesizing... ✨";
        btnElement.disabled = true;

        try {
            const wavUrl = await callGeminiTTS(text);
            currentlySpeakingAudio = new Audio(wavUrl);
            currentlySpeakingAudio.play();
            btnElement.textContent = "🔊 Playing... 🌟";
            currentlySpeakingAudio.onended = () => {
                btnElement.textContent = "🔊 Speak Aloud ✨";
                btnElement.disabled = false;
            };
        } catch (error) {
            btnElement.textContent = "❌ Failed Speech";
            setTimeout(() => {
                btnElement.textContent = "🔊 Speak Aloud ✨";
                btnElement.disabled = false;
            }, 2000);
        }
    }

    // Dedicated speak trigger for the default sage greeting
    function speakGreeting() {
        const text = `Greetings, traveler. I am the Keeper of the Chronology. I see your timeline entered our stream on ${chatOriginDate.textContent}, marking your Earth journey at ${chatCurrentAge.textContent}. What mysteries of your era shall we explore today?`;
        const btn = document.querySelector("#ai-content-sage button[onclick='speakGreeting()']");
        playSageAudio(text, btn);
    }

    function appendChatMessage(sender, text, isUser) {
        const bubble = document.createElement('div');
        bubble.className = "flex items-start gap-3 " + (isUser ? "flex-row-reverse" : "");
        
        const avatar = document.createElement('div');
        avatar.className = `w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 text-xs ${isUser ? 'bg-gray-800 text-white' : 'bg-indigo-600 text-white'}`;
        avatar.textContent = isUser ? '👤' : '⏳';

        const content = document.createElement('div');
        content.className = `${isUser ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-white text-gray-700 rounded-tl-none'} p-3 rounded-2xl shadow-sm text-sm max-w-[85%] relative group`;
        
        // Add text block
        const textBlock = document.createElement('p');
        textBlock.textContent = text;
        content.appendChild(textBlock);

        // Add TTS Speak option if it is Chronos Sage
        if (!isUser) {
            const speakBtn = document.createElement('button');
            speakBtn.className = "mt-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs px-2 py-1 rounded-lg block transition-all font-semibold";
            speakBtn.textContent = "🔊 Speak Aloud ✨";
            speakBtn.onclick = () => playSageAudio(text, speakBtn);
            content.appendChild(speakBtn);
        }

        bubble.appendChild(avatar);
        bubble.appendChild(content);
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- Visualization ---
    function initChart() {
        const ctx = document.getElementById('monthChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Days in Month',
                    data: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
                    backgroundColor: '#6366f1',
                    borderRadius: 6,
                    hoverBackgroundColor: '#1e1b4b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 32,
                        ticks: { font: { size: 10 } }
                    },
                    x: { ticks: { font: { size: 10 } } }
                }
            }
        });
        state.isChartInitialized = true;
    }

    // --- Interaction Handling ---
    document.getElementById('calc-btn').addEventListener('click', () => {
        if (validate()) calculate();
    });

    aiGenerateBtn.addEventListener('click', () => {
        generateTemporalReport();
    });

    reportRetryBtn.addEventListener('click', () => {
        generateTemporalReport();
    });

    chatSendBtn.addEventListener('click', () => {
        sendMessageToSage();
    });

    chatUserInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessageToSage();
    });

    aiSigilBtn.addEventListener('click', () => {
        generateCosmicSigil();
    });

    // AI Tabs Handling
    tabBtnReport.addEventListener('click', () => {
        tabBtnReport.className = "py-3 px-4 sm:px-6 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 focus:outline-none transition-all";
        tabBtnSage.className = "py-3 px-4 sm:px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-gray-900 focus:outline-none transition-all";
        tabBtnSigil.className = "py-3 px-4 sm:px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-gray-900 focus:outline-none transition-all";
        aiContentReport.classList.remove('hidden');
        aiContentSage.classList.add('hidden');
        aiContentSigil.classList.add('hidden');
        state.activeTab = 'report';
    });

    tabBtnSage.addEventListener('click', () => {
        tabBtnSage.className = "py-3 px-4 sm:px-6 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 focus:outline-none transition-all";
        tabBtnReport.className = "py-3 px-4 sm:px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-gray-900 focus:outline-none transition-all";
        tabBtnSigil.className = "py-3 px-4 sm:px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-gray-900 focus:outline-none transition-all";
        aiContentSage.classList.remove('hidden');
        aiContentReport.classList.add('hidden');
        aiContentSigil.classList.add('hidden');
        state.activeTab = 'sage';
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    tabBtnSigil.addEventListener('click', () => {
        tabBtnSigil.className = "py-3 px-4 sm:px-6 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 focus:outline-none transition-all";
        tabBtnReport.className = "py-3 px-4 sm:px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-gray-900 focus:outline-none transition-all";
        tabBtnSage.className = "py-3 px-4 sm:px-6 text-sm font-semibold border-b-2 border-transparent text-gray-500 hover:text-gray-900 focus:outline-none transition-all";
        aiContentSigil.classList.remove('hidden');
        aiContentReport.classList.add('hidden');
        aiContentSage.classList.add('hidden');
        state.activeTab = 'sigil';
    });

    function updateNav(el) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        el.classList.add('active');
    }

    // Scroll Spy for Nav
    window.addEventListener('scroll', () => {
        const sections = ['dashboard', 'ai-suite', 'theory', 'validation'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.top >= 0 && rect.top <= 300) {
                    const navLink = document.querySelector(`a[href="#${id}"]`);
                    if (navLink) updateNav(navLink);
                }
            }
        });
    });

    window.onload = () => {
        initChart();
    };