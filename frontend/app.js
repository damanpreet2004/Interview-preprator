// State Variables
let sessionId = localStorage.getItem('prep_session_id');
let activeChatId = localStorage.getItem('prep_active_chat_id');
let chats = [];
let hasResume = false;
let hasAnalysis = false;

// API Base URL (Dynamic detection, works for both single-port or cross-origin dev setups)
const API_BASE = window.location.origin;

// Initialize Session ID if not present
if (!sessionId) {
    sessionId = generateUUID();
    localStorage.setItem('prep_session_id', sessionId);
}

// Helper to generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const panelDivider = document.getElementById('panelDivider');
const analysisPanel = document.getElementById('analysisPanel');
const toggleAnalysisBtn = document.getElementById('toggleAnalysisBtn');
const resumeInput = document.getElementById('resumeInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const uploadBtnLabel = document.getElementById('uploadBtnLabel');
const analyzeBtn = document.getElementById('analyzeBtn');
const chatList = document.getElementById('chatList');
const newChatBtn = document.getElementById('newChatBtn');
const chatMessages = document.getElementById('chatMessages');
const currentChatTitle = document.getElementById('currentChatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const analysisStatusBadge = document.getElementById('analysisStatusBadge');
const analysisEmptyState = document.getElementById('analysisEmptyState');
const analysisLoading = document.getElementById('analysisLoading');
const analysisResults = document.getElementById('analysisResults');

// Elements for rendering Analysis
const analysisSummary = document.getElementById('analysisSummary');
const techSkillsTags = document.getElementById('techSkillsTags');
const softSkillsTags = document.getElementById('softSkillsTags');
const projectsList = document.getElementById('projectsList');
const weakBulletPointsList = document.getElementById('weakBulletPointsList');
const improvementsList = document.getElementById('improvementsList');
const missingSkillsTags = document.getElementById('missingSkillsTags');

// Helper headers
function getHeaders() {
    return {
        'X-Session-ID': sessionId,
        'Content-Type': 'application/json'
    };
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkResumeStatus();
    await loadChatHistory();
    
    // Auto-select active chat if stored
    if (activeChatId) {
        await selectChat(activeChatId);
    } else {
        showWelcomeState();
    }
});

// Setup DOM Event Listeners
function setupEventListeners() {
    // Sidebar toggle (Mobile)
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Close sidebar on item click on mobile
    chatList.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && e.target.closest('.chat-item')) {
            sidebar.classList.remove('open');
        }
    });

    // Toggle Analysis Panel
    toggleAnalysisBtn.addEventListener('click', () => {
        analysisPanel.classList.toggle('collapsed');
        if (analysisPanel.classList.contains('collapsed')) {
            panelDivider.style.display = 'none';
        } else {
            panelDivider.style.display = 'block';
        }
    });

    // File Upload Handler
    resumeInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            await handleFileUpload(file);
        }
    });

    // Analyze Button Handler
    analyzeBtn.addEventListener('click', async () => {
        await triggerResumeAnalysis();
    });

    // New Chat Button
    newChatBtn.addEventListener('click', async () => {
        if (!hasResume) {
            showToast('Please upload a resume first before starting an interview.', 'error');
            return;
        }
        await startNewChat();
    });

    // Textarea auto-resize & Enter key triggers
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight - 20) + 'px';
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    sendBtn.addEventListener('click', sendChatMessage);
}

// --- API ACTIONS ---

// 1. Check Resume Status
async function checkResumeStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/resume/status`, {
            headers: getHeaders()
        });
        const data = await response.json();
        
        hasResume = data.has_resume;
        hasAnalysis = data.has_analysis;
        
        if (hasResume) {
            fileNameDisplay.textContent = data.filename;
            analyzeBtn.removeAttribute('disabled');
            chatInput.removeAttribute('disabled');
            sendBtn.removeAttribute('disabled');
            analysisStatusBadge.textContent = "Resume Loaded";
            analysisStatusBadge.classList.add('success');
            
            if (hasAnalysis) {
                // Fetch analysis data
                await fetchAndRenderAnalysis();
            } else {
                showAnalysisEmptyState("Ready to Analyze", "Click the 'Analyze Resume' button at the top to extract skills, projects, and improvement recommendations.");
            }
        } else {
            fileNameDisplay.textContent = "No file selected (PDF/DOCX)";
            analyzeBtn.setAttribute('disabled', 'true');
            chatInput.setAttribute('disabled', 'true');
            sendBtn.setAttribute('disabled', 'true');
            analysisStatusBadge.textContent = "Pending Upload";
            analysisStatusBadge.classList.remove('success');
            showAnalysisEmptyState("Upload Your Resume", "Once you upload your PDF or Word resume, Gemini will extract the text, analyze your profile, and give you professional feedback here.");
        }
    } catch (err) {
        console.error("Error checking resume status:", err);
    }
}

// 2. Handle File Upload
async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    // UI state
    uploadBtnLabel.querySelector('span').textContent = 'Uploading...';
    uploadBtnLabel.style.opacity = '0.7';
    
    try {
        const response = await fetch(`${API_BASE}/api/resume/upload`, {
            method: 'POST',
            headers: {
                'X-Session-ID': sessionId
            },
            body: formData
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Upload failed');
        }
        
        const data = await response.json();
        showToast('Resume uploaded and parsed successfully!', 'success');
        
        // Reset state for new resume
        activeChatId = null;
        localStorage.removeItem('prep_active_chat_id');
        showWelcomeState();
        
        await checkResumeStatus();
        await loadChatHistory();
        
    } catch (err) {
        showToast(err.message, 'error');
        console.error(err);
    } finally {
        uploadBtnLabel.querySelector('span').textContent = 'Upload Resume';
        uploadBtnLabel.style.opacity = '1';
        resumeInput.value = ''; // Reset input element
    }
}

// 3. Trigger Resume Analysis
async function triggerResumeAnalysis() {
    if (analyzeBtn.disabled) return;
    
    // UI states
    analysisEmptyState.classList.add('hidden');
    analysisResults.classList.add('hidden');
    analysisLoading.classList.remove('hidden');
    analyzeBtn.setAttribute('disabled', 'true');
    analysisStatusBadge.textContent = "Analyzing...";
    
    try {
        const response = await fetch(`${API_BASE}/api/resume/analyze`, {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Analysis failed');
        }
        
        const data = await response.json();
        renderAnalysis(data);
        hasAnalysis = true;
        analysisStatusBadge.textContent = "Analysis Complete";
        analysisStatusBadge.classList.add('success');
        showToast('Resume analysis completed!', 'success');
        
    } catch (err) {
        showToast(err.message, 'error');
        console.error(err);
        analysisStatusBadge.textContent = "Analysis Failed";
        analysisStatusBadge.classList.remove('success');
        showAnalysisEmptyState("Analysis Failed", "An error occurred while calling Gemini. Please try again.");
    } finally {
        analyzeBtn.removeAttribute('disabled');
        analysisLoading.classList.add('hidden');
    }
}

// Helper to fetch cached analysis
async function fetchAndRenderAnalysis() {
    analysisEmptyState.classList.add('hidden');
    analysisLoading.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/api/resume/analyze`, {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            renderAnalysis(data);
            analysisStatusBadge.textContent = "Analysis Complete";
            analysisStatusBadge.classList.add('success');
        }
    } catch (err) {
        console.error("Failed to load existing analysis:", err);
    } finally {
        analysisLoading.classList.add('hidden');
    }
}

// 4. Load Chat History list
async function loadChatHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/chat/history`, {
            headers: getHeaders()
        });
        const data = await response.json();
        chats = data.chats || [];
        renderChatList();
    } catch (err) {
        console.error("Error loading chat history:", err);
    }
}

// 5. Start New Chat Session
async function startNewChat() {
    try {
        const response = await fetch(`${API_BASE}/api/chat/new`, {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to create new interview session');
        
        const data = await response.json();
        activeChatId = data.chat_id;
        localStorage.setItem('prep_active_chat_id', activeChatId);
        
        await loadChatHistory();
        await selectChat(activeChatId);
        
        // Start interview immediately with an intro prompt
        chatInput.focus();
        showToast('New interview simulator started!', 'success');
        
        // Push an empty list to chat screen
        chatMessages.innerHTML = '';
        appendMessage('model', "Hello! I am your AI Technical Interviewer. I have analyzed your resume and we are ready to begin. Whenever you're ready, let me know or just say 'I am ready to start the interview'!");
        
    } catch (err) {
        showToast(err.message, 'error');
        console.error(err);
    }
}

// 6. Select a Chat Session
async function selectChat(chatId) {
    activeChatId = chatId;
    localStorage.setItem('prep_active_chat_id', chatId);
    
    // Highlight list item
    document.querySelectorAll('.chat-item').forEach(item => {
        if (item.dataset.id === chatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const activeChat = chats.find(c => c.id === chatId);
    currentChatTitle.textContent = activeChat ? activeChat.title : "Interview Session";
    chatSubtitle.textContent = "Mock Technical Interview in progress";
    
    // Load messages
    chatMessages.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Retrieving chat history...</p></div>';
    
    try {
        const response = await fetch(`${API_BASE}/api/chat/${chatId}`, {
            headers: getHeaders()
        });
        
        if (!response.ok) throw new Error("Failed to load messages.");
        
        const messages = await response.json();
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            // New chat helper instruction
            appendMessage('model', "Hello! I am your AI Technical Interviewer. I have analyzed your resume and we are ready to begin. Whenever you're ready, let me know or just say 'I am ready to start the interview'!");
        } else {
            messages.forEach(msg => {
                appendMessage(msg.role, msg.content);
            });
        }
        
        // Scroll to bottom
        scrollToBottom();
        
    } catch (err) {
        console.error(err);
        chatMessages.innerHTML = '<div class="empty-state-prompt"><h4>Error Loading Chat</h4><p>Could not retrieve previous messages.</p></div>';
    }
}

// 7. Send Chat Message
async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !activeChatId) return;
    
    // Clear input & resize
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Render user message immediately
    appendMessage('user', text);
    scrollToBottom();
    
    // Show typing indicator
    toggleTypingIndicator(true);
    chatInput.setAttribute('disabled', 'true');
    sendBtn.setAttribute('disabled', 'true');
    
    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                chat_id: activeChatId,
                message: text
            })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Chat request failed');
        }
        
        const data = await response.json();
        
        // Hide typing indicator
        toggleTypingIndicator(false);
        
        // Append response
        appendMessage('model', data.reply);
        scrollToBottom();
        
        // Reload chat list in case title updated
        await loadChatHistory();
        
    } catch (err) {
        toggleTypingIndicator(false);
        showToast(err.message, 'error');
        appendMessage('model', `[Error]: ${err.message}. Please verify your Gemini API Key is correctly configured in backend/.env`);
        scrollToBottom();
    } finally {
        chatInput.removeAttribute('disabled');
        sendBtn.removeAttribute('disabled');
        chatInput.focus();
    }
}


// --- UI RENDERING HELPERS ---

function showWelcomeState() {
    chatMessages.innerHTML = `
        <div class="chat-welcome-state" id="chatWelcomeState">
            <div class="chat-welcome-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h3>AI Mock Interviewer</h3>
            <p class="chat-welcome-desc">Upload your resume first to activate the mock interview. The AI interviewer will ask tailored questions based on your experience, starting with simple warm-ups and advancing to deep technical discussions.</p>
            
            <div class="chat-tips">
                <div class="tip-item">
                    <span class="tip-badge">Step 1</span>
                    <span>Upload your PDF/DOCX resume using the button above.</span>
                </div>
                <div class="tip-item">
                    <span class="tip-badge">Step 2</span>
                    <span>Click "Analyze Resume" for AI insights (optional but recommended).</span>
                </div>
                <div class="tip-item">
                    <span class="tip-badge">Step 3</span>
                    <span>Click "New Interview" or start typing to begin the simulator!</span>
                </div>
            </div>
        </div>
    `;
    currentChatTitle.textContent = "Mock Interview";
    chatSubtitle.textContent = "Select a chat or upload a resume to start";
}

function showAnalysisEmptyState(title, description) {
    analysisResults.classList.add('hidden');
    analysisLoading.classList.add('hidden');
    analysisEmptyState.classList.remove('hidden');
    analysisEmptyState.querySelector('h4').textContent = title;
    analysisEmptyState.querySelector('p').textContent = description;
}

function renderChatList() {
    chatList.innerHTML = '';
    
    if (chats.length === 0) {
        chatList.innerHTML = '<div class="no-chats">No interviews started yet</div>';
        return;
    }
    
    chats.forEach(chat => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'chat-item';
        item.dataset.id = chat.id;
        if (chat.id === activeChatId) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>${chat.title}</span>
        `;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            selectChat(chat.id);
        });
        
        chatList.appendChild(item);
    });
}

function appendMessage(role, content) {
    // Remove welcome state if present
    const welcome = document.getElementById('chatWelcomeState');
    if (welcome) welcome.remove();

    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${role === 'user' ? 'user-msg' : 'model-msg'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    
    const meta = document.createElement('span');
    meta.className = 'msg-bubble-meta';
    meta.textContent = role === 'user' ? 'You' : 'Interviewer';
    
    bubble.appendChild(meta);
    
    // Process markdown-like syntax
    const processedContent = document.createElement('div');
    processedContent.innerHTML = formatMarkdown(content);
    bubble.appendChild(processedContent);
    
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
}

function renderAnalysis(data) {
    analysisEmptyState.classList.add('hidden');
    analysisResults.classList.remove('hidden');
    
    // 1. Summary
    analysisSummary.textContent = data.summary || "No summary provided.";
    
    // 2. Technical Skills
    techSkillsTags.innerHTML = '';
    if (data.technical_skills && data.technical_skills.length > 0) {
        data.technical_skills.forEach(skill => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = skill;
            techSkillsTags.appendChild(span);
        });
    } else {
        techSkillsTags.innerHTML = '<span class="text-muted">None identified.</span>';
    }

    // 3. Soft Skills
    softSkillsTags.innerHTML = '';
    if (data.soft_skills && data.soft_skills.length > 0) {
        data.soft_skills.forEach(skill => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = skill;
            softSkillsTags.appendChild(span);
        });
    } else {
        softSkillsTags.innerHTML = '<span class="text-muted">None identified.</span>';
    }

    // 4. Projects
    projectsList.innerHTML = '';
    if (data.projects && data.projects.length > 0) {
        data.projects.forEach(project => {
            const li = document.createElement('li');
            li.innerHTML = formatMarkdown(project);
            projectsList.appendChild(li);
        });
    } else {
        projectsList.innerHTML = '<li>No major projects identified.</li>';
    }

    // 5. Weak Bullet Points
    weakBulletPointsList.innerHTML = '';
    if (data.weak_bullet_points && data.weak_bullet_points.length > 0) {
        data.weak_bullet_points.forEach(bullet => {
            const li = document.createElement('li');
            
            // Format bullet if it separates the original and rewrite by a indicator like 'Rewrite:' or '->'
            // We just render as list item and let formatMarkdown bold things.
            li.innerHTML = formatMarkdown(bullet);
            weakBulletPointsList.appendChild(li);
        });
    } else {
        weakBulletPointsList.innerHTML = '<li>No weak bullet points detected. Perfect!</li>';
    }

    // 6. Improvements
    improvementsList.innerHTML = '';
    if (data.improvements && data.improvements.length > 0) {
        data.improvements.forEach(imp => {
            const li = document.createElement('li');
            li.innerHTML = formatMarkdown(imp);
            improvementsList.appendChild(li);
        });
    } else {
        improvementsList.innerHTML = '<li>No improvements suggested. Excellent resume structure!</li>';
    }

    // 7. Missing Skills
    missingSkillsTags.innerHTML = '';
    if (data.missing_skills && data.missing_skills.length > 0) {
        data.missing_skills.forEach(skill => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = skill;
            missingSkillsTags.appendChild(span);
        });
    } else {
        missingSkillsTags.innerHTML = '<span class="text-muted">No key missing skills identified.</span>';
    }
}

// Markdown Formatter Utility
function formatMarkdown(text) {
    if (!text) return "";
    
    // Basic HTML escaping
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    // Replace **bold** with <strong>bold</strong>
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Replace *italic* with <em>italic</em>
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Replace `code` with <code>code</code>
    escaped = escaped.replace(/`(.*?)`/g, "<code>$1</code>");
    
    // Process line items
    const lines = escaped.split("\n");
    let inList = false;
    let listType = null; // 'ul' or 'ol'
    const html = [];
    
    for (let line of lines) {
        const trimmed = line.trim();
        
        // Bullet list item
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            if (!inList) {
                html.push("<ul>");
                inList = true;
                listType = 'ul';
            } else if (listType !== 'ul') {
                html.push("</ol><ul>");
                listType = 'ul';
            }
            html.push(`<li>${trimmed.substring(2)}</li>`);
        } 
        // Ordered list item
        else if (/^\d+\.\s/.test(trimmed)) {
            if (!inList) {
                html.push("<ol>");
                inList = true;
                listType = 'ol';
            } else if (listType !== 'ol') {
                html.push("</ul><ol>");
                listType = 'ol';
            }
            const content = trimmed.replace(/^\d+\.\s/, "");
            html.push(`<li>${content}</li>`);
        } 
        // Normal paragraph
        else {
            if (inList) {
                html.push(listType === 'ol' ? "</ol>" : "</ul>");
                inList = false;
                listType = null;
            }
            if (trimmed !== "") {
                html.push(`<p>${trimmed}</p>`);
            }
        }
    }
    
    // Close remaining list open tags
    if (inList) {
        html.push(listType === 'ol' ? "</ol>" : "</ul>");
    }
    
    return html.join("\n");
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleTypingIndicator(show) {
    if (show) {
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.classList.add('hidden');
    }
}

// Toast popup utility
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') {
        icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
        icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    
    // Remove toast after 3.5s
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}
