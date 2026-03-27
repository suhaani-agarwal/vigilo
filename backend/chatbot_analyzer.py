import os
import json
from typing import Dict, List, Optional
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
from vigilo_utils import DATA_DIR, LOGS_DIR, get_company_info

class ComplianceChatbot:
    def __init__(self):
        # Load environment variables
        load_dotenv('.env.local')
        
        # Initialize Gemini client
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel("gemini-2.5-flash")
                print("Gemini model initialized successfully")
            except Exception as e:
                print(f"Failed to initialize Gemini model: {e}")
                self.model = None
        else:
            print("GEMINI_API_KEY not found, chatbot will use fallback responses")
            self.model = None
    
    def get_latest_compliance_logs(self, company_id: str) -> Optional[Dict]:
        """Get the latest compliance logs for a company - specifically stage1_combined_summaries.json and stage5_final_report.json"""
        company_logs_dir = os.path.join(LOGS_DIR, company_id)
        
        if not os.path.exists(company_logs_dir):
            return None
        
        # Get all timestamp directories and sort by latest
        log_dirs = []
        for dir_name in os.listdir(company_logs_dir):
            dir_path = os.path.join(company_logs_dir, dir_name)
            if os.path.isdir(dir_path):
                try:
                    # Parse timestamp from directory name (format: YYYYMMDD_HHMMSS)
                    dt = datetime.strptime(dir_name, "%Y%m%d_%H%M%S")
                    log_dirs.append((dt, dir_path))
                except ValueError:
                    continue
        
        if not log_dirs:
            return None
        
        # Get the latest directory
        latest_dt, latest_dir = max(log_dirs, key=lambda x: x[0])
        
        # Load only the two required log files
        log_files = {
            "stage1_summaries": "stage1_combined_summaries.json",
            "stage5_report": "stage5_final_report.json"
        }
        
        logs_data = {}
        for log_name, filename in log_files.items():
            file_path = os.path.join(latest_dir, filename)
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        logs_data[log_name] = json.load(f)
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
                    logs_data[log_name] = None
            else:
                print(f"File not found: {file_path}")
                logs_data[log_name] = None
        
        return {
            "timestamp": latest_dt,
            "directory": latest_dir,
            "logs": logs_data
        }
    
    def format_logs_for_ai(self, logs_data: Dict) -> str:
        """Format the two required log files into a structured prompt for the AI"""
        if not logs_data.get("logs"):
            return "No compliance logs found for analysis."
        
        logs = logs_data["logs"]
        formatted_text = "# COMPLIANCE ANALYSIS REPORT\n\n"
        
        # Add amendment summaries from stage1_combined_summaries.json
        if logs.get("stage1_summaries") and logs["stage1_summaries"].get("amendments"):
            formatted_text += "## Amendment Summaries\n\n"
            amendments = logs["stage1_summaries"]["amendments"]
            for i, amendment in enumerate(amendments, 1):
                formatted_text += f"### {i}. {amendment.get('title', 'Untitled Amendment')}\n"
                formatted_text += f"**Summary**: {amendment.get('summary', 'No summary available')}\n\n"
                
                if amendment.get('requirements'):
                    formatted_text += "**Key Requirements**:\n"
                    for req in amendment.get('requirements', []):
                        formatted_text += f"- {req}\n"
                    formatted_text += "\n"
                
                if amendment.get('deadlines'):
                    formatted_text += "**Deadlines**:\n"
                    for deadline in amendment.get('deadlines', []):
                        formatted_text += f"- {deadline.get('date', 'Unknown')}: {deadline.get('raw', 'No details')}\n"
                    formatted_text += "\n"
                
                if amendment.get('affected_businesses'):
                    formatted_text += f"**Affected Businesses**: {', '.join(amendment.get('affected_businesses', []))}\n"
                
                formatted_text += f"**Impact Level**: {amendment.get('impact', 'Unknown')}\n\n"
                formatted_text += "---\n\n"
        
        # Add final compliance report from stage5_final_report.json
        if logs.get("stage5_report") and logs["stage5_report"].get("compliance_report"):
            report = logs["stage5_report"]["compliance_report"]
            formatted_text += "## Final Compliance Report\n\n"
            
            formatted_text += f"**Overall Status**: {report.get('overall_status', 'Unknown')}\n\n"
            formatted_text += f"**Executive Summary**: {report.get('summary', 'No summary available')}\n\n"
            
            # Add by_amendment findings
            if report.get('by_amendment'):
                formatted_text += "### Detailed Findings by Amendment\n\n"
                for i, finding in enumerate(report.get('by_amendment', []), 1):
                    formatted_text += f"#### {i}. {finding.get('amendment_title', 'Unknown Amendment')}\n"
                    formatted_text += f"**Status**: {finding.get('status', 'Unknown')}\n"
                    formatted_text += f"**Urgency**: {finding.get('urgency', 'Medium')}\n\n"
                    
                    formatted_text += f"**Current State**: {finding.get('current_state', 'No information')}\n\n"
                    formatted_text += f"**Required Actions**: {finding.get('to_be_done', 'No specific actions defined')}\n\n"
                    
                    if finding.get('gaps'):
                        formatted_text += "**Identified Gaps**:\n"
                        for gap in finding.get('gaps', []):
                            formatted_text += f"- {gap}\n"
                        formatted_text += "\n"
                    
                    if finding.get('actions'):
                        formatted_text += "**Recommended Actions**:\n"
                        for action in finding.get('actions', []):
                            formatted_text += f"- {action}\n"
                        formatted_text += "\n"
                    
                    if finding.get('last_date') and finding.get('last_date') != 'Unknown':
                        formatted_text += f"**Deadline**: {finding.get('last_date')}\n\n"
                    
                    formatted_text += "---\n\n"
            
            # Add prioritized actions
            if report.get('prioritized_actions'):
                formatted_text += "### Prioritized Actions\n\n"
                for i, action in enumerate(report.get('prioritized_actions', []), 1):
                    formatted_text += f"{i}. **{action.get('department', 'General')}**: {action.get('task', 'Unknown task')}\n"
                    formatted_text += f"   - **Due**: {action.get('due', 'Unknown')}\n"
                    formatted_text += f"   - **Urgency**: {action.get('urgency', 'Medium')}\n"
                    if action.get('rationale'):
                        formatted_text += f"   - **Rationale**: {action.get('rationale')}\n"
                    formatted_text += "\n"
            
            # Add timeline if available
            if report.get('timeline'):
                formatted_text += "### Compliance Timeline\n\n"
                for timeline in report.get('timeline', []):
                    formatted_text += f"**{timeline.get('timeframe', 'Unknown Timeframe')}**:\n"
                    for action in timeline.get('actions', []):
                        formatted_text += f"- {action.get('department', 'General')}: {action.get('task', 'Unknown task')}\n"
                    formatted_text += "\n"
        
        return formatted_text
    
    def analyze_compliance_query(self, query: str, company_id: str) -> str:
        """Analyze compliance logs and answer user query using only the two required files"""
        # Get latest logs
        logs_data = self.get_latest_compliance_logs(company_id)
        if not logs_data:
            return "No compliance analysis found for this company. Please run a compliance check first."
        
        # Format logs for AI
        formatted_logs = self.format_logs_for_ai(logs_data)
        
        # If Gemini model is not available, return basic response
        if not self.model:
            return self._fallback_response(query, formatted_logs)
        
        try:
            # Create comprehensive prompt
            prompt = f"""
            You are a compliance analysis assistant. Analyze the following compliance report and answer the user's question.

            COMPLIANCE REPORT:
            {formatted_logs}

            USER QUESTION: {query}

            Please provide a comprehensive, professional response that:
            1. Directly addresses the user's question and is breif ,concise and addresses the user
            2. References specific amendments, requirements, or actions from the report
            3. Provides clear explanations and recommendations
            4. Uses bullet points for clarity when appropriate
            5. Highlights urgent items if relevant
            6. Suggests next steps if applicable

            Format your response in clear, professional business language.
            """
            
            # Call Gemini API
            response = self.model.generate_content(prompt)
            
            return response.text
            
        except Exception as e:
            print(f"Gemini API error: {e}")
            return self._fallback_response(query, formatted_logs)
    
    def _fallback_response(self, query: str, formatted_logs: str) -> str:
        """Fallback response when Gemini is not available"""
        return f"""
        I've analyzed your compliance data. Here's what I found:

        Your Question: {query}

        Compliance Summary Available:
        {formatted_logs[:1000]}...

        For detailed AI-powered analysis, please ensure the Gemini API key is configured.
        You can ask about:
        - Specific amendment requirements
        - Compliance deadlines
        - Recommended actions
        - Department-wise responsibilities
        - Urgent compliance items
        """
    
    def get_compliance_overview(self, company_id: str) -> Dict:
        """Get a quick overview of compliance status from the two files"""
        logs_data = self.get_latest_compliance_logs(company_id)
        if not logs_data:
            return {"status": "no_data", "message": "No compliance analysis found"}
        
        logs = logs_data["logs"]
        overview = {
            "timestamp": logs_data["timestamp"].isoformat(),
            "status": "unknown",
            "amendment_count": 0,
            "urgent_actions": 0,
            "departments_involved": []
        }
        
        # Count amendments from stage1
        if logs.get("stage1_summaries") and logs["stage1_summaries"].get("amendments"):
            overview["amendment_count"] = len(logs["stage1_summaries"]["amendments"])
        
        # Analyze final report from stage5
        if logs.get("stage5_report") and logs["stage5_report"].get("compliance_report"):
            report = logs["stage5_report"]["compliance_report"]
            overview["status"] = report.get("overall_status", "unknown")
            
            # Count urgent actions from by_amendment
            if report.get("by_amendment"):
                urgent_findings = [f for f in report["by_amendment"] 
                                 if f.get("urgency") in ["Critical", "High"]]
                overview["urgent_actions"] = len(urgent_findings)
            
            # Get departments involved from prioritized_actions and timeline
            departments = set()
            if report.get("prioritized_actions"):
                for action in report["prioritized_actions"]:
                    if action.get("department"):
                        departments.add(action["department"])
            if report.get("timeline"):
                for timeline in report["timeline"]:
                    for action in timeline.get("actions", []):
                        if action.get("department"):
                            departments.add(action["department"])
            
            overview["departments_involved"] = list(departments)
        
        return overview

# Global chatbot instance
compliance_chatbot = ComplianceChatbot()