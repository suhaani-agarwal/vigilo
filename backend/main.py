from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from vigilo_utils import (
    update_vector_db,
    get_metadata_store,
    store_company_data,
    CompanyData,
    CompanyInfo,
    ComplianceDocument,
    ProductInfo,
    PackagingInfo,
    hash_company,
    get_company_info,
    ingest_local_pdfs_from,
    get_latest_company_id,
    update_rbi_only,
    load_rbi_metadata,
    get_latest_rbi_amendments,
    update_dgft_only,
    load_dgft_metadata,
    update_gst_only,
    load_gst_metadata,
    save_filtered_amendments,
    get_latest_by_sources
)
from chatbot_analyzer import compliance_chatbot
from typing import List, Dict, Optional, Any
from fastapi import UploadFile, Form, File, HTTPException
from datetime import date
import hashlib
import json
import os
from fastapi.responses import FileResponse
from prompt_chain import AmendmentAnalyzer
from prompt_chain import select_relevant_amendments
from vigilo_utils import backfill_metadata_excerpts

app = FastAPI(title="Vigilo FSSAI Compliance API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"msg": "Vigilo FSSAI Compliance API Running 🚀"}

@app.get("/update")
def update() -> Dict[str, int]:
    count = update_vector_db()
    return {"new_entries": count}

@app.get("/update-rbi")
def update_rbi() -> Dict[str, int]:
    """Update only RBI notifications"""
    count = update_rbi_only()
    return {"new_entries": count, "source": "RBI"}

@app.get("/list-rbi")
def list_rbi_notifications() -> List[Dict]:
    """Get only RBI notifications"""
    data = load_rbi_metadata()
    if not data:
        # Attempt to populate if empty
        try:
            update_rbi_only()
            data = load_rbi_metadata()
        except Exception:
            pass
    return data

@app.get("/amendments-rbi")
def get_rbi_amendments(limit: int = 6) -> List[Dict]:
    """Get latest RBI amendments only"""
    return get_latest_rbi_amendments(limit)

@app.get("/list")
def list_notifications() -> List[Dict]:
    return get_metadata_store()

@app.get("/test-scrape")
def test_scrape():
    from vigilo_utils import scrape_fssai_notifications
    return scrape_fssai_notifications()

@app.get("/test-scrape-rbi")
def test_scrape_rbi():
    from vigilo_utils import scrape_rbi_notifications
    return scrape_rbi_notifications()

@app.get("/test-scrape-dgft")
def test_scrape_dgft():
    from vigilo_utils import scrape_dgft_notifications
    return scrape_dgft_notifications()

@app.get("/seed/synthetic")
def seed_synthetic() -> Dict[str, int]:
    """Ingest local PDFs from synthetic_pdfs_detailed/ for quick testing."""
    base_dir = os.path.dirname(os.path.dirname(__file__))  # project root
    dir_path = os.path.join(base_dir, "synthetic_pdfs_detailed")
    added = ingest_local_pdfs_from(dir_path)
    return {"ingested": added}

@app.get("/update-dgft")
def update_dgft() -> Dict[str, Any]:  
    count = update_dgft_only()
    return {"new_entries": count, "source": "DGFT"}

@app.get("/list-dgft")
def list_dgft_notifications() -> List[Dict]:
    """Get only DGFT notifications"""
    # You'll need to implement load_dgft_metadata() similar to load_rbi_metadata()
    data = load_dgft_metadata()
    if not data:
        # Attempt to populate if empty
        try:
            update_dgft_only()
            data = load_dgft_metadata()
        except Exception:
            pass
    return data

@app.get("/update-gst")
def update_gst() -> Dict[str, Any]:
    """Update only GST notifications"""
    count = update_gst_only()
    return {"new_entries": count, "source": "GST"}

@app.get("/list-gst")
def list_gst_notifications() -> List[Dict]:
    """Get only GST notifications"""
    data = load_gst_metadata()
    if not data:
        try:
            update_gst_only()
            data = load_gst_metadata()
        except Exception:
            pass
    return data

@app.get("/test-scrape-gst")
def test_scrape_gst():
    """Test GST scraping"""
    from vigilo_utils import scrape_gst_notifications
    return scrape_gst_notifications()


# @app.get("/latest-relevant")
# def latest_relevant(company_id: Optional[str] = None):
#     """Return the most recent and (likely) most relevant amendments:
#     - 4 from FSSAI
#     - 3 from DGFT
#     - 3 from GST
#     Each item contains title, date, excerpt, pdf_url, document_id and source.
#     """
#     try:
#         # Load recent 10 from each source
#         fssai_meta = get_metadata_store()  # general metadata.json
#         fssai_sorted = sorted([m for m in fssai_meta if m.get("source") == "FSSAI"], key=lambda m: (m.get("date") or ""), reverse=True)[:10]

#         dgft_sorted = load_dgft_metadata()
#         dgft_sorted = sorted(dgft_sorted, key=lambda m: (m.get("date") or ""), reverse=True)[:10]

#         gst_sorted = load_gst_metadata()
#         gst_sorted = sorted(gst_sorted, key=lambda m: (m.get("date") or ""), reverse=True)[:10]

#         # Fetch company profile if provided (pass minimal fields to the AI)
#         company_profile = None
#         if company_id:
#             company_profile = get_company_info(company_id)

#         print(f"/latest-relevant: company_id={company_id} fssai_candidates={len(fssai_sorted)} dgft_candidates={len(dgft_sorted)} gst_candidates={len(gst_sorted)}")
#         # Use AI (Groq) per-source to pick relevant items with requested counts
#         selected_fssai = select_relevant_amendments(fssai_sorted, top_n=5, source="FSSAI", company=company_profile)
#         selected_dgft = select_relevant_amendments(dgft_sorted, top_n=3, source="DGFT", company=company_profile)
#         selected_gst = select_relevant_amendments(gst_sorted, top_n=3, source="GST", company=company_profile)

#         print(f"/latest-relevant: selected fssai={len(selected_fssai)} dgft={len(selected_dgft)} gst={len(selected_gst)}")
#         return {"FSSAI": selected_fssai, "DGFT": selected_dgft, "GST": selected_gst}
#     except Exception as e:
#         print(f"Error in latest_relevant: {e}")
#         return {"FSSAI": [], "DGFT": [], "GST": []}
def _load_company_json(company_id: str) -> Optional[Dict]:
    """Load complete company JSON data"""
    base_dir = os.path.dirname(__file__)
    path = os.path.join(base_dir, "data", "companies", f"{company_id}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            try:
                return json.load(f)
            except Exception:
                return None
    return None

@app.get("/latest-relevant")
def latest_relevant(company_id: Optional[str] = None):
    """Return the most recent and relevant amendments: 5 FSSAI, 4 DGFT, 3 GST"""
    try:
        # Load recent amendments from each source
        fssai_meta = get_metadata_store()
        fssai_sorted = sorted([m for m in fssai_meta if m.get("source") == "FSSAI"], 
                             key=lambda m: (m.get("date") or ""), reverse=True)[:15]  # More candidates

        dgft_meta = load_dgft_metadata()
        dgft_sorted = sorted(dgft_meta, key=lambda m: (m.get("date") or ""), reverse=True)[:15]

        gst_meta = load_gst_metadata()
        gst_sorted = sorted(gst_meta, key=lambda m: (m.get("date") or ""), reverse=True)[:15]

        # Fetch company profile
        company_profile = None
        if company_id:
            company_profile = get_company_info(company_id)
            # Also get company description
            company_data = _load_company_json(company_id)
            if company_data and company_data.get("optional_data"):
                company_profile = company_profile or {}
                company_profile["description"] = company_data["optional_data"].get("business_description", "")

        print(f"/latest-relevant: company_id={company_id} fssai_candidates={len(fssai_sorted)} dgft_candidates={len(dgft_sorted)} gst_candidates={len(gst_sorted)}")
        
        # Select amendments with different models
        selected_fssai = select_relevant_amendments(fssai_sorted, top_n=5, source="FSSAI",
                                                   company=company_profile, model="llama-3.3-70b-versatile")
        selected_dgft = select_relevant_amendments(dgft_sorted, top_n=5, source="DGFT", 
                                                  company=company_profile, model="gemini-2.5-flash-lite")
        selected_gst = select_relevant_amendments(gst_sorted, top_n=5, source="GST", 
                                                 company=company_profile, model="gemini-2.5-flash-lite")

        print(f"/latest-relevant: selected fssai={len(selected_fssai)} dgft={len(selected_dgft)} gst={len(selected_gst)}")
        
        # Combine all results
        combined = selected_fssai + selected_dgft + selected_gst
        
        # Save filtered amendments to separate folder
        save_filtered_amendments(combined, company_id)
        
        return combined
        
    except Exception as e:
        print(f"Error in latest_relevant: {e}")
        import traceback
        traceback.print_exc()
        return []

@app.get("/backfill-excerpts")
def backfill_excerpts():
    """Scan existing metadata entries and populate excerpt fields where missing."""
    try:
        res = backfill_metadata_excerpts()
        return {"status": "ok", "updated": res}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.post("/company/submit")
async def submit_company_data(
    # Company Info
    company_name: str = Form(...),
    address: str = Form(""),
    fssai_license: str = Form(""),
    fssai_validity: Optional[str] = Form(None),
    business_type: Optional[str] = Form(None),
    gst_number: Optional[str] = Form(None),
    
    # Legal Documents
    fssai_file: Optional[UploadFile] = File(None),
    gst_file: Optional[UploadFile] = File(None),
    audit_file: Optional[UploadFile] = File(None),
    lab_report_file: Optional[UploadFile] = File(None),
    
    # Product Details
    product_name: str = Form("Default Product"),
    product_category: str = Form("general"),
    ingredients: str = Form("{}"),  # JSON string
    nutrition: str = Form("{}"),    # JSON string
    allergens: str = Form(""),      # Comma-separated
    
    # Packaging
    label_front: Optional[UploadFile] = File(None),
    label_back: Optional[UploadFile] = File(None),
    expiry_format: str = Form("DD/MM/YYYY"),
    claims: str = Form(""),        # Comma-separated

    # Additional product documents
    ingredients_file: Optional[UploadFile] = File(None),
    nutrition_file: Optional[UploadFile] = File(None),
):
    # Save uploaded files
    def save_file(file: UploadFile) -> str:
        base_dir = os.path.dirname(__file__)
        upload_dir = os.path.join(base_dir, "data", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        path = os.path.join(upload_dir, f"{hashlib.md5(file.filename.encode()).hexdigest()}_{file.filename}")
        with open(path, 'wb') as f:
            f.write(file.file.read())
        return path

    # Prepare company data
    company_data = CompanyData(
        company_info=CompanyInfo(
            company_name=company_name,
            address=address,
            fssai_license=fssai_license,
            fssai_validity=date.fromisoformat(fssai_validity) if fssai_validity else date.today(),
            business_type=business_type or "",
            gst_number=gst_number
        ),
        legal_documents=[
            # Added conditionally below
        ],
        products=[
            ProductInfo(
                product_name=product_name,
                category=product_category,
                ingredients=json.loads(ingredients),
                nutritional_info=json.loads(nutrition),
                allergens=[a.strip() for a in allergens.split(",")] if allergens else []
            )
        ],
        packaging=[
            PackagingInfo(
                label_front_url=save_file(label_front) if label_front else "",
                label_back_url=save_file(label_back) if label_back else "",
                expiry_format=expiry_format,
                packaging_claims=[c.strip() for c in claims.split(",")] if claims else []
            )
        ]
    )

    # Add legal docs conditionally
    if fssai_file:
        company_data.legal_documents.append(ComplianceDocument(
            document_type="FSSAI License",
            file_path=save_file(fssai_file),
            issue_date=date.today()
        ))
    if gst_file:
        company_data.legal_documents.append(ComplianceDocument(
            document_type="GST Certificate",
            file_path=save_file(gst_file),
            issue_date=date.today()
        ))
    if lab_report_file:
        company_data.legal_documents.append(ComplianceDocument(
            document_type="Lab Test Report",
            file_path=save_file(lab_report_file),
            issue_date=date.today()
        ))
    if audit_file:
        company_data.legal_documents.append(ComplianceDocument(
            document_type="Audit Report",
            file_path=save_file(audit_file),
            issue_date=date.today()
        ))

    # Optional product/packaging-related PDFs
    if ingredients_file:
        company_data.legal_documents.append(ComplianceDocument(
            document_type="Ingredients Document",
            file_path=save_file(ingredients_file),
            issue_date=date.today()
        ))
    if nutrition_file:
        company_data.legal_documents.append(ComplianceDocument(
            document_type="Nutritional Information Document",
            file_path=save_file(nutrition_file),
            issue_date=date.today()
        ))

    store_company_data(company_data)
    return {"status": "success", "company_id": hash_company(company_name)}

# @app.get("/compliance/check")
# async def check_company_compliance(company_id: str):
#     """Run the new 5-stage prompt chain for a company.

#     This uses:
#     - First 5 PDFs from backend/data/pdfs as amendments
#     - Company info from backend/data/companies/<company_id>.json
#     - First 2 and next 3 PDFs from backend/data/uploads as company docs
#     Logs are saved under backend/data/logs/<company_id>/<timestamp>/
#     """
#     try:
#         result = analyze_amendments_for_company(company_id)
#         return {"status": "success", "result": result}
#     except Exception as e:
#         # Provide a clear error with hint
#         raise HTTPException(status_code=400, detail=f"Compliance check failed: {e}")

# def analyze_amendments_for_company(company_id: str) -> Dict:
#     """Run the new 5-stage prompt chain using on-disk PDFs and company uploads."""
#     company = get_company_info(company_id)
#     if not company:
#         raise ValueError("Company not found. Submit company data first.")
#     uploads_dir = os.path.join(os.path.dirname(__file__), "data", "uploads")
#     analyzer = AmendmentAnalyzer(company_id=company_id)
#     return analyzer.run_full_chain(company, uploads_dir=uploads_dir)
@app.get("/compliance/check")
async def check_company_compliance(company_id: str):
    """Run the updated 5-stage prompt chain for a company using filtered amendments."""
    try:
        result = analyze_amendments_for_company(company_id)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Compliance check failed: {e}")

def analyze_amendments_for_company(company_id: str) -> Dict:
    """Run the updated 5-stage prompt chain using filtered amendments."""
    company = get_company_info(company_id)
    if not company:
        raise ValueError("Company not found. Submit company data first.")
    uploads_dir = os.path.join(os.path.dirname(__file__), "data", "uploads")
    analyzer = AmendmentAnalyzer(company_id=company_id)
    return analyzer.run_full_chain(company, uploads_dir=uploads_dir)

@app.get("/pdf")
def get_pdf(document_id: str):
    """Return PDF file for a given document_id from metadata store."""
    try:
        meta = get_metadata_store()
        match = next((m for m in meta if (m.get("document_id") == document_id)), None)
        # If not found in FSSAI metadata, look in RBI metadata
        if not match:
            rbi_meta = load_rbi_metadata()
            match = next((m for m in rbi_meta if (m.get("document_id") == document_id)), None)
        if not match:
            raise HTTPException(status_code=404, detail="Document not found")
        path = match.get("pdf_path")
        if not path:
            raise HTTPException(status_code=404, detail="PDF file not found")
        # Resolve relative paths against backend directory
        if not os.path.isabs(path):
            base_dir = os.path.dirname(__file__)
            path = os.path.join(base_dir, path)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="PDF file not found")
        fname = os.path.basename(path)
        return FileResponse(path, media_type="application/pdf", filename=fname)
    except HTTPException:
        raise

@app.get("/company/latest")
def latest_company():
    """Return the latest company's id and brief info. Frontend uses this to run compliance."""
    cid = get_latest_company_id()
    if not cid:
        raise HTTPException(status_code=404, detail="No companies found")
    info = get_company_info(cid)
    return {"company_id": cid, "company_info": info}

@app.get("/chatbot/analyze")
async def analyze_compliance_chatbot(company_id: str, query: str):
    """AI chatbot endpoint for compliance analysis using only stage1 and stage5 files"""
    try:
        if not company_id:
            raise HTTPException(status_code=400, detail="Company ID is required")
        
        if not query or len(query.strip()) < 3:
            raise HTTPException(status_code=400, detail="Query must be at least 3 characters")
        
        response = compliance_chatbot.analyze_compliance_query(query.strip(), company_id)
        return {
            "status": "success",
            "response": response,
            "company_id": company_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot analysis failed: {str(e)}")

@app.get("/chatbot/overview")
async def get_compliance_overview(company_id: str):
    """Get compliance overview for a company from stage1 and stage5 files"""
    try:
        if not company_id:
            raise HTTPException(status_code=400, detail="Company ID is required")
        
        overview = compliance_chatbot.get_compliance_overview(company_id)
        return {
            "status": "success",
            "overview": overview,
            "company_id": company_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get compliance overview: {str(e)}")

@app.get("/chatbot/logs")
async def get_compliance_logs(company_id: str):
    """Get available compliance logs for a company"""
    try:
        if not company_id:
            raise HTTPException(status_code=400, detail="Company ID is required")
        
        logs_data = compliance_chatbot.get_latest_compliance_logs(company_id)
        if not logs_data:
            return {
                "status": "no_data",
                "message": "No compliance logs found for this company",
                "company_id": company_id
            }
        
        return {
            "status": "success",
            "timestamp": logs_data["timestamp"].isoformat(),
            "directory": logs_data["directory"],
            "log_files": ["stage1_combined_summaries.json", "stage5_final_report.json"],
            "company_id": company_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get compliance logs: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5005)