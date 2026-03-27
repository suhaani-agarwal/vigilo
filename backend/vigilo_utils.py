import os
import requests
from bs4 import BeautifulSoup
import pdfplumber
from datetime import datetime, time
from typing import List, Dict
import hashlib
import json
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document
import re
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date

class CompanyInfo(BaseModel):
    company_name: str
    address: str
    fssai_license: str
    fssai_validity: date
    business_type: str  # manufacturer/distributor/importer/retailer
    gst_number: Optional[str] = None
    incorporation_number: Optional[str] = None

class ProductInfo(BaseModel):
    product_name: str
    category: str
    ingredients: Dict[str, Optional[float]]  # {ingredient: percentage}
    nutritional_info: Dict[str, str]  # {nutrient: value}
    allergens: List[str]
    batch_number: Optional[str] = None

class PackagingInfo(BaseModel):
    label_front_url: str  # Path to stored image/PDF
    label_back_url: str
    expiry_format: str  # e.g. "DD/MM/YYYY"
    packaging_claims: List[str]  # ["organic", "gluten-free", etc.]

class ComplianceDocument(BaseModel):
    document_type: str  # e.g. "FSSAI License", "Lab Test Report"
    file_path: str
    issue_date: date
    expiry_date: Optional[date] = None
    verified: bool = False

class CompanyData(BaseModel):
    company_info: CompanyInfo
    legal_documents: List[ComplianceDocument]
    products: List[ProductInfo]
    packaging: List[PackagingInfo]
    optional_data: Optional[Dict[str, str]] = None  # For ads/supplier info


# Configuration (absolute paths under backend/data)
BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
PDF_DIR = os.path.join(DATA_DIR, "pdfs")
METADATA_FILE = os.path.join(DATA_DIR, "metadata.json")
LOGS_DIR = os.path.join(DATA_DIR, "logs")
os.makedirs(PDF_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)
RBI_PDF_DIR = os.path.join(DATA_DIR, "rbi-pdf")
os.makedirs(RBI_PDF_DIR, exist_ok=True)

# Initialize vector stores
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vector_store = Chroma(
    collection_name="fssai_notifications",
    embedding_function=embeddings,
    persist_directory="data/vector_db"
)

# Company data stored as JSON only (no vector DB per requirements)
METADATA_RBI_FILE = os.path.join(DATA_DIR, "metadataRBI.json")

METADATA_DGFT_FILE = os.path.join(DATA_DIR, "metadataDGFT.json")

METADATA_GST_FILE = os.path.join(DATA_DIR, "metadataGST.json")

def load_rbi_metadata() -> List[Dict]:
    """Load RBI-specific metadata"""
    if os.path.exists(METADATA_RBI_FILE):
        try:
            with open(METADATA_RBI_FILE, 'r') as f:
                content = f.read().strip()
                if not content:  # Handle empty file
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Warning: Error loading RBI metadata, creating fresh: {e}")
            return []
    return []

def save_rbi_metadata(metadata: List[Dict]):
    """Save RBI-specific metadata"""
    with open(METADATA_RBI_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def load_metadata() -> List[Dict]:
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'r') as f:
            return json.load(f)
    return []

def save_metadata(metadata: List[Dict]):
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def get_pdf_filename(url: str, title: str) -> str:
    """Generate consistent PDF filename from URL and title"""
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    # Clean title to make it filesystem-safe
    clean_title = re.sub(r'[^\w\-\. ]', '', title)[:50]
    return f"{clean_title}_{url_hash}.pdf"

def extract_date_from_text(text: str) -> str:
    """Extract date from text like '[Uploaded on : 14-08-2025]'"""
    match = re.search(r'\[Uploaded on : (\d{2}-\d{2}-\d{4})\]', text)
    if match:
        return match.group(1)
    return "Unknown"

def extract_date_from_rbi_text(text: str) -> str:
    """Extract date from RBI format - handles multiple formats"""
    if not text:
        return "Unknown"
    
    # Try formats like "Aug 25, 2025" or "August 25, 2025"
    match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s+(\d{4})', text, re.IGNORECASE)
    if match:
        month_name, day, year = match.groups()
        month_num = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08', 
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        }
        return f"{int(day):02d}-{month_num[month_name.lower()[:3]]}-{year}"
    
    # Try full month name format
    match = re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})', text, re.IGNORECASE)
    if match:
        month_name, day, year = match.groups()
        month_num = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08', 
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
        }
        return f"{int(day):02d}-{month_num[month_name.lower()]}-{year}"
    
    # Try DD-MM-YYYY format
    match = re.search(r'(\d{1,2})-(\d{1,2})-(\d{4})', text)
    if match:
        day, month, year = match.groups()
        return f"{int(day):02d}-{int(month):02d}-{year}"
    
    return "Unknown"

def scrape_fssai_notifications() -> List[Dict]:
    """Scrape FSSAI notifications page for PDF documents"""
    base_url = "https://www.fssai.gov.in/notifications.php"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        notifications = []
        
        # First page
        notifications.extend(scrape_fssai_page(base_url, headers))
        
        # If you want to scrape multiple pages, you can add pagination here
        # For example, to scrape first 3 pages:
        # for page in range(2, 4):
        #     url = f"{base_url}?pages={page}"
        #     notifications.extend(scrape_fssai_page(url, headers))
        
        return notifications
        
    except Exception as e:
        print(f"Error scraping FSSAI notifications: {e}")
        return []

def scrape_fssai_page(url: str, headers: dict) -> List[Dict]:
    """Scrape a single FSSAI notifications page"""
    try:
        r = requests.get(url, headers=headers)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        
        notifications = []
        
        # Find all notification groups
        for group in soup.select(".grouptr12"):
            # Extract the title and date from the strong tag
            strong_tag = group.find("p").find("strong")
            if not strong_tag:
                continue
                
            full_text = strong_tag.get_text(strip=True)
            
            # Extract title (remove the ♦ symbol if present)
            title = full_text.split('♦')[-1].strip()
            
            # Extract date from the text
            date = extract_date_from_text(full_text)
            
            # Find all PDF links in this group
            for link in group.select("a[href$='.pdf']"):
                pdf_url = link["href"]
                
                # Make absolute URL if relative
                if not pdf_url.startswith("http"):
                    pdf_url = f"https://www.fssai.gov.in/{pdf_url.lstrip('/')}"
                
                notifications.append({
                    "title": title,
                    "pdf_url": pdf_url,
                    "date": date,
                    "source": "FSSAI"
                })
        
        return notifications
        
    except Exception as e:
        print(f"Error scraping FSSAI page {url}: {e}")
        return []

def scrape_rbi_notifications() -> List[Dict]:
    """Scrape RBI notifications page for PDF documents - simplified approach"""
    base_url = "https://www.rbi.org.in/Scripts/NotificationUser.aspx"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        notifications = []
        
        # Scrape the main notifications page
        notifications.extend(scrape_rbi_page(base_url, headers))
        
        
        return notifications
        
    except Exception as e:
        print(f"Error scraping RBI notifications: {e}")
        return []

def scrape_rbi_page(url: str, headers: dict) -> List[Dict]:
    """Scrape RBI notifications page with correct selectors for PDF/PNG notifications"""
    try:
        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        notifications = []
        current_date = "Unknown"

        print("DEBUG: Starting RBI scraping...")

        # RBI notifications are grouped in div#pnlDetails
        content_area = soup.find("div", id="pnlDetails") or soup.find("div", class_="content_area")
        if not content_area:
            print("DEBUG: No content area found")
            return notifications

        tables = content_area.find_all("table")
        print(f"DEBUG: Found {len(tables)} tables in content area")

        for table in tables:
            rows = table.find_all("tr")

            for row in rows:
                # Date header row
                date_header = row.find("td", class_="tableheader")
                if date_header:
                    date_text = date_header.get_text(strip=True)
                    current_date = extract_date_from_rbi_text(date_text)
                    print(f"DEBUG: Found date header: {date_text} -> {current_date}")
                    continue

                # Look for RBI's <a id="APDF_..."> links (they may end with .pdf OR .png)
                pdf_links = row.find_all("a", id=lambda v: v and v.startswith("APDF_"))
                for a in pdf_links:
                    href = a.get("href")
                    if not href:
                        continue

                    # Normalize URL
                    pdf_url = href
                    if not pdf_url.startswith("http"):
                        if pdf_url.startswith("//"):
                            pdf_url = f"https:{pdf_url}"
                        elif pdf_url.startswith("/"):
                            pdf_url = f"https://www.rbi.org.in{pdf_url}"
                        else:
                            pdf_url = f"https://www.rbi.org.in/{pdf_url}"

                    # Title extraction: use the nearest preceding <td> with text, fallback generic
                    title_cell = row.find("td", style=lambda x: x and 'word-wrap:break-word' in x)
                    if title_cell:
                        title = title_cell.get_text(strip=True)
                    else:
                        title = "RBI Notification"

                    # Clean title
                    title = re.sub(r'\s*\d+\s*[Kk][Bb]\s*$', '', title).strip()

                    notifications.append({
                        "title": title,
                        "pdf_url": pdf_url,
                        "date": current_date,
                        "source": "RBI"
                    })
                    print(f"DEBUG: Added notification: {title} -> {pdf_url}")

        print(f"DEBUG: Total notifications found: {len(notifications)}")
        return notifications

    except Exception as e:
        print(f"Error scraping RBI page {url}: {e}")
        import traceback
        traceback.print_exc()
        return []
    

def download_pdf(url: str, filename: str, target_dir: str = PDF_DIR) -> str:
    """Download PDF if not already exists to the specified directory.
    Defaults to FSSAI PDF_DIR for backward compatibility.
    """
    path = os.path.join(target_dir, filename)
    if not os.path.exists(path):
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            r = requests.get(url, headers=headers, stream=True)
            r.raise_for_status()
            with open(path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        except Exception as e:
            print(f"Error downloading PDF {url}: {e}")
            return ""
    return path

def extract_text_from_pdf(path: str) -> str:
    """Extract text from PDF with error handling"""
    if not os.path.exists(path):
        return ""
        
    text = ""
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"Error extracting text from {path}: {e}")
    return text.strip()

def extract_text_from_file(path: str) -> str:
    """Best-effort text extraction for different file types.
    - PDF: use pdfplumber
    - TXT: read as text
    - Others: return empty string
    """
    if not path or not os.path.exists(path):
        return ""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(path)
    if ext in [".txt", ".md", ".csv"]:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            return ""
    # Image/Docx OCR not implemented in this basic version
    return ""


def extract_excerpt(text: str, max_lines: int = 7) -> str:
    """Return the first `max_lines` non-empty lines from `text` as a single string.
    Filters out non-English text and excessive formatting.
    """
    if not text:
        return ""
    
    # Split into lines and clean
    lines = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        
        # Filter out lines that are mostly non-English (Hindi/Devanagari characters)
        devanagari_chars = re.findall(r'[\u0900-\u097F]', line)
        if len(devanagari_chars) / max(1, len(line)) > 0.3:  # More than 30% Devanagari
            continue
            
        # Filter out lines that are mostly numbers/special chars
        alpha_chars = re.findall(r'[a-zA-Z]', line)
        if len(alpha_chars) / max(1, len(line)) < 0.2:  # Less than 20% alphabetic
            continue
            
        lines.append(line)
        if len(lines) >= max_lines:
            break
    
    # Join with space to create a readable excerpt
    return " ".join(lines[:max_lines])

def chunk_text(text: str, metadata: Dict) -> List[Document]:
    """Split text into chunks with metadata"""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    
    chunks = text_splitter.split_text(text)
    documents = []
    for i, chunk in enumerate(chunks):
        doc_metadata = metadata.copy()
        doc_metadata["chunk"] = i
        documents.append(Document(page_content=chunk, metadata=doc_metadata))
    return documents

def update_vector_db() -> int:
    """Update vector DB with new notifications"""
    print("Starting update process...")
    existing_metadata = load_metadata()
    print(f"Existing metadata count: {len(existing_metadata)}")
    existing_urls = {item["pdf_url"] for item in existing_metadata}
    
    notifications = scrape_fssai_notifications()
    print(f"Found {len(notifications)} notifications")
    
    new_count = 0
    
    for notification in notifications:
        print(f"\nProcessing notification: {notification['title']}")
        
        if notification["pdf_url"] in existing_urls:
            print("Already exists, skipping")
            continue
            
        # Download and process new notification
        filename = get_pdf_filename(notification["pdf_url"], notification["title"])
        print(f"Downloading PDF to {filename}")
        pdf_path = download_pdf(notification["pdf_url"], filename)
        
        if not pdf_path:
            print("Failed to download PDF")
            continue
            
        print("Extracting text from PDF")
        text = extract_text_from_pdf(pdf_path)
        if not text:
            print("No text extracted")
            continue
        
        # Extract meaningful description (first few meaningful sentences)
        description = extract_description(text)
        
        # Prepare metadata
        metadata = {
            "title": notification["title"],
            "date": notification["date"],
            "source": notification["source"],
            "pdf_url": notification["pdf_url"],
            "pdf_path": pdf_path,
            "document_id": hashlib.md5(notification["pdf_url"].encode()).hexdigest(),
            "description": description  # Add description field
        }
        
        print("Chunking text and adding to vector store")
        documents = chunk_text(text, sanitize_metadata(metadata))
        vector_store.add_documents(documents)
        
        # Update metadata
        existing_metadata.append(metadata)
        new_count += 1
        print("Successfully processed")
    
    if new_count > 0:
        print(f"Saving {new_count} new entries")
        save_metadata(existing_metadata)
        vector_store.persist()
    
    return new_count

def extract_description(text: str, max_sentences: int = 3) -> str:
    """Extract meaningful description from text"""
    if not text:
        return ""
    
    # Split into sentences
    sentences = re.split(r'[.!?]+', text)
    meaningful_sentences = []
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        # Filter out short sentences and those with too many special chars
        if len(sentence) < 20:
            continue
            
        # Filter out non-English sentences
        devanagari_chars = re.findall(r'[\u0900-\u097F]', sentence)
        if len(devanagari_chars) / max(1, len(sentence)) > 0.2:
            continue
            
        # Look for sentences that seem like regulatory content
        regulatory_keywords = ['regulation', 'amendment', 'standard', 'requirement', 
                              'compliance', 'labeling', 'safety', 'food', 'product']
        if any(keyword in sentence.lower() for keyword in regulatory_keywords):
            meaningful_sentences.append(sentence)
            if len(meaningful_sentences) >= max_sentences:
                break
    
    return " ".join(meaningful_sentences) if meaningful_sentences else extract_excerpt(text, 2)

def update_rbi_only() -> int:
    """Update only RBI notifications without affecting FSSAI"""
    print("Starting RBI-only update process...")
    existing_rbi_metadata = load_rbi_metadata()
    existing_urls = {item["pdf_url"] for item in existing_rbi_metadata}
    
    rbi_notifications = scrape_rbi_notifications()
    print(f"Found {len(rbi_notifications)} RBI notifications")
    
    new_count = 0
    
    for notification in rbi_notifications:
        if notification["pdf_url"] in existing_urls:
            continue
            
        filename = get_pdf_filename(notification["pdf_url"], notification["title"])
        pdf_path = download_pdf(notification["pdf_url"], filename, target_dir=RBI_PDF_DIR)
        
        if not pdf_path:
            continue
            
        text = extract_text_from_pdf(pdf_path)
        
        metadata = {
            "title": notification["title"],
            "date": notification["date"],
            "source": notification["source"],
            "pdf_url": notification["pdf_url"],
            "pdf_path": pdf_path,
            "document_id": hashlib.md5(notification["pdf_url"].encode()).hexdigest(),
            # RBI: no short excerpt stored (keep metadata minimal)
        }
        
        # Only add to vector store if text was extracted, but always save metadata
        if text:
            documents = chunk_text(text, sanitize_metadata(metadata))
            vector_store.add_documents(documents)
        existing_rbi_metadata.append(metadata)
        new_count += 1
    
    if new_count > 0:
        print(f"Saving {new_count} new RBI entries")
        save_rbi_metadata(existing_rbi_metadata)
        vector_store.persist()
    
    return new_count


def get_metadata_store() -> List[Dict]:
    """Get all stored metadata"""
    return load_metadata()

def _parse_date(d: str) -> datetime:
    # Try common formats used in scraping (e.g., "14-08-2025")
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(d, fmt)
        except Exception:
            continue
    return datetime.min

def get_latest_amendments(limit: int = 6) -> List[Dict]:
    """Return latest amendments with full text content by reading stored PDFs.
    Output: [{title, date, content, id}]
    """
    meta = load_metadata()
    # Sort by parsed date descending; unknown at end
    meta_sorted = sorted(meta, key=lambda m: _parse_date(m.get("date", "")), reverse=True)
    results: List[Dict] = []
    for m in meta_sorted[:limit]:
        content = extract_text_from_pdf(m.get("pdf_path", ""))
        results.append({
            "title": m.get("title", ""),
            "date": m.get("date", "Unknown"),
            "content": content,
            "id": m.get("document_id") or hashlib.md5(m.get("pdf_url", "").encode()).hexdigest()
        })
    return results
def get_latest_rbi_amendments(limit: int = 6) -> List[Dict]:
    """Return latest RBI amendments only"""
    meta = load_rbi_metadata()
    meta_sorted = sorted(meta, key=lambda m: _parse_date(m.get("date", "")), reverse=True)
    results: List[Dict] = []
    for m in meta_sorted[:limit]:
        content = extract_text_from_pdf(m.get("pdf_path", ""))
        results.append({
            "title": m.get("title", ""),
            "date": m.get("date", "Unknown"),
            "content": content,
            "id": m.get("document_id"),
            "source": "RBI"
        })
    return results


def get_latest_by_sources(counts: Dict[str, int]) -> List[Dict]:
    """Return a combined list of latest amendments per source.
    counts: mapping like {"FSSAI":4, "DGFT":3, "GST":3}
    Result preserves ordering: FSSAI items first (most recent), then DGFT, then GST.
    """
    out: List[Dict] = []
    # FSSAI uses general metadata file
    if counts.get("FSSAI", 0) > 0:
        meta = load_metadata()
        meta_sorted = sorted([m for m in meta if m.get("source") == "FSSAI"], key=lambda m: _parse_date(m.get("date", "")), reverse=True)
        for m in meta_sorted[: counts.get("FSSAI")]:
            out.append({
                "title": m.get("title", ""),
                "date": m.get("date", "Unknown"),
                # Provide the short preview under `description` for FSSAI
                "description": m.get("description", ""),
                "pdf_url": m.get("pdf_url", ""),
                "pdf_path": m.get("pdf_path", ""),
                "document_id": m.get("document_id", hashlib.md5(m.get("pdf_url","").encode()).hexdigest()),
                "source": "FSSAI"
            })

    if counts.get("DGFT", 0) > 0:
        meta = load_dgft_metadata()
        meta_sorted = sorted(meta, key=lambda m: _parse_date(m.get("date", "")), reverse=True)
        for m in meta_sorted[: counts.get("DGFT")]:
            out.append({
                "title": m.get("title", ""),
                "date": m.get("date", "Unknown"),
                # Use the DGFT-provided description (if any); do NOT rely on an excerpt
                "description": m.get("description", ""),
                "pdf_url": m.get("pdf_url", ""),
                "pdf_path": m.get("pdf_path", ""),
                "document_id": m.get("document_id"),
                "source": "DGFT"
            })

    if counts.get("GST", 0) > 0:
        meta = load_gst_metadata()
        meta_sorted = sorted(meta, key=lambda m: _parse_date(m.get("date", "")), reverse=True)
        for m in meta_sorted[: counts.get("GST")]:
            out.append({
                "title": m.get("title", ""),
                "date": m.get("date", "Unknown"),
                # Use GST description field (no excerpt)
                "description": m.get("description", ""),
                "pdf_url": m.get("pdf_url", ""),
                "pdf_path": m.get("pdf_path", ""),
                "document_id": m.get("document_id"),
                "source": "GST"
            })

    return out

def _load_company_json(company_id: str) -> Optional[Dict]:
    """Load complete company JSON data"""
    path = os.path.join(DATA_DIR, "companies", f"{company_id}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            try:
                return json.load(f)
            except Exception:
                return None
    return None


def sanitize_metadata(d: Dict) -> Dict:
    """Convert complex metadata values into primitives acceptable by Chroma (str/int/float/bool/None).
    - dates/datetimes -> ISO string
    - lists/dicts -> JSON string
    - others left as-is
    """
    out: Dict = {}
    for k, v in (d or {}).items():
        try:
            if v is None:
                out[k] = None
            elif isinstance(v, (date, datetime)):
                out[k] = v.isoformat()
            elif isinstance(v, (list, dict)):
                out[k] = json.dumps(v)
            else:
                out[k] = v
        except Exception:
            out[k] = str(v)
    return out

def get_company_info(company_id: str) -> Optional[Dict]:
    """Return normalized company info dict used by prompt chain"""
    data = _load_company_json(company_id)
    if not data:
        return None
    ci = data.get("company_info", {})
    optional = data.get("optional_data") or {}
    return {
        "name": ci.get("company_name", ""),
        "business_type": ci.get("business_type", ""),
        "description": optional.get("business_description", ""),
        "fssai_license": ci.get("fssai_license", ""),
        "fssai_validity": ci.get("fssai_validity", "")
    }

def get_company_products(company_id: str) -> List[Dict]:
    """Return simplified list of products expected by prompt chain"""
    data = _load_company_json(company_id) or {}
    products = data.get("products", [])
    packaging = data.get("packaging", [])
    claims_all = []
    for p in packaging:
        claims_all.extend(p.get("packaging_claims", []) or [])
    simplified = []
    for p in products:
        ingredients = list((p.get("ingredients") or {}).keys())
        simplified.append({
            "name": p.get("product_name", "Product"),
            "category": p.get("category", ""),
            "ingredients": ingredients,
            "allergens": p.get("allergens", []) or [],
            "claims": claims_all or []
        })
    return simplified

def get_company_documents(company_id: str) -> List[str]:
    """Return list of stored legal document file paths for a company"""
    data = _load_company_json(company_id) or {}
    docs = []
    for d in data.get("legal_documents", []) or []:
        if d.get("file_path"):
            docs.append(d["file_path"])
    return docs

def ingest_local_pdfs_from(dir_path: str) -> int:
    """Ingest all PDFs from a local directory as amendments with today's date.
    Returns number of new entries added.
    """
    if not os.path.isdir(dir_path):
        return 0
    existing = load_metadata()
    existing_urls = {m.get("pdf_url") for m in existing}
    new_count = 0
    for fname in os.listdir(dir_path):
        if not fname.lower().endswith(".pdf"):
            continue
        fpath = os.path.join(dir_path, fname)
        # Create a pseudo URL to dedupe
        pseudo_url = f"file://{os.path.abspath(fpath)}"
        if pseudo_url in existing_urls:
            continue
        title = os.path.splitext(fname)[0].replace('_', ' ')
        metadata = {
            "title": title,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "source": "LOCAL",
            "pdf_url": pseudo_url,
            "pdf_path": fpath,
            "document_id": hashlib.md5(pseudo_url.encode()).hexdigest(),
        }
        text = extract_text_from_pdf(fpath)
        if not text:
            continue
        docs = chunk_text(text, metadata)
        vector_store.add_documents(docs)
        existing.append(metadata)
        new_count += 1
    if new_count:
        save_metadata(existing)
        vector_store.persist()
    return new_count

def store_company_data(company_data: CompanyData):
    """Store company data as JSON only (no vector DB)."""
    # Ensure uploads in JSON refer to absolute paths where possible
    save_company_json(company_data)

def hash_company(name: str) -> str:
    return hashlib.md5(name.encode()).hexdigest()

def save_company_json(company_data: CompanyData):
    """Store complete structured data for retrieval under backend/data/companies"""
    path = os.path.join(DATA_DIR, "companies", f"{hash_company(company_data.company_info.company_name)}.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(company_data.model_dump_json(indent=2))

def get_latest_company_id() -> Optional[str]:
    """Return the company_id (filename without .json) of the most recently modified company file.
    If none found, return None.
    """
    companies_dir = os.path.join(DATA_DIR, "companies")
    if not os.path.isdir(companies_dir):
        return None
    latest_id: Optional[str] = None
    latest_mtime: float = -1.0
    try:
        for fname in os.listdir(companies_dir):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(companies_dir, fname)
            try:
                mtime = os.path.getmtime(fpath)
                if mtime > latest_mtime:
                    latest_mtime = mtime
                    latest_id = os.path.splitext(fname)[0]
            except Exception:
                continue
        return latest_id
    except Exception:
        return None

def extract_date_from_dgft_text(text: str) -> str:
    """Try common DGFT date formats, fallback Unknown"""
    if not text:
        return "Unknown"
    # common DD-MM-YYYY pattern
    m = re.search(r'(\d{2}-\d{2}-\d{4})', text)
    if m:
        return m.group(1)
    # Try other formats like '14 Aug 2025' or 'August 14, 2025'
    m = re.search(r'(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})', text, re.IGNORECASE)
    if m:
        try:
            dt = datetime.strptime(m.group(1), "%d %b %Y")
            return dt.strftime("%d-%m-%Y")
        except Exception:
            pass
    return "Unknown"

def scrape_dgft_notifications() -> List[Dict]:
    """Scrape DGFT notifications table and return list of {number, year, description, date, pdf_url, source}"""
    base_url = "https://www.dgft.gov.in/CP/?opt=notification"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    try:
        r = requests.get(base_url, headers=headers, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        notifications = []
        table = soup.find("table", id="metaTable")
        if not table:
            # Some pages may render differently; try any table with class or fallback to rows
            table = soup.find("table")
            if not table:
                print("DGFT: no table found")
                return notifications

        tbody = table.find("tbody") or table
        rows = tbody.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 6:
                continue
            # columns: 0 Sl.No, 1 Number, 2 Year, 3 Description, 4 Date, 5 CRT DT (hidden), 6 Attachment
            number = cells[1].get_text(strip=True)
            year = cells[2].get_text(strip=True)
            description = cells[3].get_text(" ", strip=True)
            date_str = cells[4].get_text(strip=True) or extract_date_from_dgft_text(description)

            # Attachment might be in the last cell (find a link ending with .pdf)
            pdf_url = ""
            # Some DGFT attachments are anchors with href in the last cell
            attach_cell = None
            # prefer the last cell if it contains link
            for c in cells[::-1]:
                if c.find("a"):
                    attach_cell = c
                    break
            if attach_cell:
                a = attach_cell.find("a", href=True)
                if a:
                    pdf_url = a["href"]
                    if not pdf_url.startswith("http"):
                        # make absolute
                        if pdf_url.startswith("/"):
                            pdf_url = f"https://www.dgft.gov.in{pdf_url}"
                        else:
                            pdf_url = f"https://www.dgft.gov.in/{pdf_url}"

            notifications.append({
                "number": number,
                "year": year,
                "description": description,
                "date": date_str,
                "pdf_url": pdf_url,
                "source": "DGFT"
            })
        return notifications
    except Exception as e:
        print(f"Error scraping DGFT: {e}")
        return []

def update_dgft_only(target_pdf_dir: str = None) -> int:
    """Download new DGFT notifications, ingest into vector DB and update DGFT metadata"""
    target_pdf_dir = target_pdf_dir or os.path.join(DATA_DIR, "dgft-pdfs")
    os.makedirs(target_pdf_dir, exist_ok=True)

    existing = load_dgft_metadata()  # Use DGFT metadata instead of general metadata
    existing_urls = {m.get("pdf_url") for m in existing}
    new_count = 0

    notifications = scrape_dgft_notifications()
    print(f"DGFT: found {len(notifications)} notifications")

    for n in notifications:
        pdf_url = n.get("pdf_url")
        if not pdf_url:
            continue
        if pdf_url in existing_urls:
            continue

        filename = get_pdf_filename(pdf_url, n.get("description", "dgft_notification"))
        pdf_path = download_pdf(pdf_url, filename, target_dir=target_pdf_dir)
        
        if not pdf_path:
            continue

        text = extract_text_from_pdf(pdf_path)
        metadata = {
            "title": f"DGFT Notification {n.get('number')} / {n.get('year')}",
            "number": n.get("number"),
            "year": n.get("year"),
            "description": n.get("description"),
            "date": n.get("date") or "Unknown",
            "source": "DGFT",
            "pdf_url": pdf_url,
            "pdf_path": pdf_path,
            "document_id": hashlib.md5(pdf_url.encode()).hexdigest(),
            # Do NOT store an "excerpt" for DGFT
        }

        if text:
            docs = chunk_text(text, sanitize_metadata(metadata))
            vector_store.add_documents(docs)

        existing.append(metadata)
        new_count += 1

    if new_count:
        save_dgft_metadata(existing)  # Save to DGFT-specific metadata

    return new_count

def load_dgft_metadata() -> List[Dict]:
    """Load DGFT-specific metadata"""
    if os.path.exists(METADATA_DGFT_FILE):
        try:
            with open(METADATA_DGFT_FILE, 'r') as f:
                content = f.read().strip()
                if not content:  # Handle empty file
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Warning: Error loading DGFT metadata, creating fresh: {e}")
            return []
    return []

def save_dgft_metadata(metadata: List[Dict]):
    """Save DGFT-specific metadata"""
    with open(METADATA_DGFT_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def scrape_gst_notifications() -> List[Dict]:
    """Scrape GST Council notifications with pagination"""
    base_url = "https://gstcouncil.gov.in/cgst-tax-notification"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    notifications = []
    page = 0
    max_pages = 10  # Limit to prevent infinite looping
    
    try:
        while page < max_pages:
            url = f"{base_url}?page={page}"
            print(f"Scraping GST page {page}: {url}")
            
            r = requests.get(url, headers=headers, timeout=30)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            
            # Find the notifications table
            table = soup.find("tbody")
            if not table:
                print(f"No table found on page {page}, stopping")
                break
            
            rows = table.find_all("tr")
            if not rows:
                print(f"No rows found on page {page}, stopping")
                break
            
            page_notifications = []
            
            for row in rows:
                try:
                    # Extract data from each column
                    cells = row.find_all("td")
                    if len(cells) < 5:
                        continue
                    
                    # Column 1: Counter (we'll ignore this)
                    # Column 2: Notification number and date
                    notification_info = cells[1].get_text(strip=True)
                    
                    # Column 3: English PDF link
                    english_link = cells[2].find("a")
                    english_url = english_link.get("href") if english_link else None
                    
                    # Column 4: Hindi PDF link (we'll use English version)
                    # Column 5: Description
                    description = cells[4].get_text(strip=True)
                    
                    if english_url:
                        # Make URL absolute
                        if not english_url.startswith("http"):
                            english_url = f"https://gstcouncil.gov.in{english_url}"
                        
                        # Extract date from notification info if possible
                        date_text = "Unknown"
                        date_match = re.search(r'(\d{2}/\d{2}/\d{4})', notification_info)
                        if date_match:
                            date_text = date_match.group(1).replace('/', '-')
                        else:
                            # Try to extract year from notification number
                            year_match = re.search(r'/(\d{4})', notification_info)
                            if year_match:
                                date_text = f"01-01-{year_match.group(1)}"  # Default to Jan 1 of that year
                        
                        # Create title from notification number and description
                        title = f"GST {notification_info}"
                        if description:
                            title = f"{title} - {description[:50]}{'...' if len(description) > 50 else ''}"
                        
                        page_notifications.append({
                            "title": title,
                            "pdf_url": english_url,
                            "date": date_text,
                            "source": "GST",
                            "notification_number": notification_info,
                            "description": description
                        })
                        
                except Exception as e:
                    print(f"Error processing row: {e}")
                    continue
            
            if not page_notifications:
                print(f"No notifications found on page {page}, stopping")
                break
            
            notifications.extend(page_notifications)
            print(f"Found {len(page_notifications)} notifications on page {page}")
            
            # Check if there's a next page
            next_page_link = soup.find("a", title="Go to next page")
            if not next_page_link:
                print("No next page link found, stopping")
                break
            
            page += 1
            time.sleep(1)  # Be polite with delays between requests
        
        print(f"Total GST notifications found: {len(notifications)}")
        return notifications
        
    except Exception as e:
        print(f"Error scraping GST notifications: {e}")
        import traceback
        traceback.print_exc()
        return notifications  # Return whatever we've collected so far

def scrape_gst_notifications() -> List[Dict]:
    """Scrape GST Council notifications with pagination"""
    base_url = "https://gstcouncil.gov.in/cgst-tax-notification"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    notifications = []
    page = 0
    max_pages = 10  # Limit to prevent infinite looping
    
    try:
        while page < max_pages:
            url = f"{base_url}?page={page}"
            print(f"Scraping GST page {page}: {url}")
            
            r = requests.get(url, headers=headers, timeout=30)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            
            # Find the notifications table
            table = soup.find("tbody")
            if not table:
                print(f"No table found on page {page}, stopping")
                break
            
            rows = table.find_all("tr")
            if not rows:
                print(f"No rows found on page {page}, stopping")
                break
            
            page_notifications = []
            
            for row in rows:
                try:
                    # Extract data from each column
                    cells = row.find_all("td")
                    if len(cells) < 5:
                        continue
                    
                    # Column 1: Counter (we'll ignore this)
                    # Column 2: Notification number and date
                    notification_info = cells[1].get_text(strip=True)
                    
                    # Column 3: English PDF link
                    english_link = cells[2].find("a")
                    english_url = english_link.get("href") if english_link else None
                    
                    # Column 4: Hindi PDF link (we'll use English version)
                    # Column 5: Description
                    description = cells[4].get_text(strip=True)
                    
                    if english_url:
                        # Make URL absolute
                        if not english_url.startswith("http"):
                            english_url = f"https://gstcouncil.gov.in{english_url}"
                        
                        # Extract date from notification info if possible
                        date_text = "Unknown"
                        date_match = re.search(r'(\d{2}/\d{2}/\d{4})', notification_info)
                        if date_match:
                            date_text = date_match.group(1).replace('/', '-')
                        else:
                            # Try to extract year from notification number
                            year_match = re.search(r'/(\d{4})', notification_info)
                            if year_match:
                                date_text = f"01-01-{year_match.group(1)}"  # Default to Jan 1 of that year
                        
                        # Create title from notification number and description
                        title = f"GST {notification_info}"
                        if description:
                            title = f"{title} - {description[:50]}{'...' if len(description) > 50 else ''}"
                        
                        page_notifications.append({
                            "title": title,
                            "pdf_url": english_url,
                            "date": date_text,
                            "source": "GST",
                            "notification_number": notification_info,
                            "description": description
                        })
                        
                except Exception as e:
                    print(f"Error processing row: {e}")
                    continue
            
            if not page_notifications:
                print(f"No notifications found on page {page}, stopping")
                break
            
            notifications.extend(page_notifications)
            print(f"Found {len(page_notifications)} notifications on page {page}")
            
            # Check if there's a next page
            next_page_link = soup.find("a", title="Go to next page")
            if not next_page_link:
                print("No next page link found, stopping")
                break
            
            page += 1
            time.sleep(1)  # Be polite with delays between requests
        
        print(f"Total GST notifications found: {len(notifications)}")
        return notifications
        
    except Exception as e:
        print(f"Error scraping GST notifications: {e}")
        import traceback
        traceback.print_exc()
        return notifications  # Return whatever we've collected so far

def load_gst_metadata() -> List[Dict]:
    """Load GST-specific metadata"""
    if os.path.exists(METADATA_GST_FILE):
        try:
            with open(METADATA_GST_FILE, 'r') as f:
                content = f.read().strip()
                if not content:
                    return []
                return json.loads(content)
        except (json.JSONDecodeError, Exception) as e:
            print(f"Warning: Error loading GST metadata, creating fresh: {e}")
            return []
    return []

def save_gst_metadata(metadata: List[Dict]):
    """Save GST-specific metadata"""
    with open(METADATA_GST_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def update_gst_only(target_pdf_dir: str = None) -> int:
    """Download new GST notifications, ingest into vector DB and update GST metadata"""
    target_pdf_dir = target_pdf_dir or os.path.join(DATA_DIR, "gst-pdfs")
    os.makedirs(target_pdf_dir, exist_ok=True)

    existing = load_gst_metadata()
    existing_urls = {m.get("pdf_url") for m in existing}
    new_count = 0

    notifications = scrape_gst_notifications()
    print(f"GST: found {len(notifications)} notifications")

    for n in notifications:
        pdf_url = n.get("pdf_url")
        if not pdf_url or pdf_url in existing_urls:
            continue

        filename = get_pdf_filename(pdf_url, n.get("title", "gst_notification"))
        pdf_path = download_pdf(pdf_url, filename, target_dir=target_pdf_dir)
        
        if not pdf_path:
            continue

        text = extract_text_from_pdf(pdf_path)
        metadata = {
            "title": n.get("title", "GST Notification"),
            "date": n.get("date", "Unknown"),
            "source": "GST",
            "pdf_url": pdf_url,
            "pdf_path": pdf_path,
            "document_id": hashlib.md5(pdf_url.encode()).hexdigest(),
            "notification_number": n.get("notification_number", ""),
            "description": n.get("description", "")
        }

        if text:
            docs = chunk_text(text, sanitize_metadata(metadata))
            vector_store.add_documents(docs)

        existing.append(metadata)
        new_count += 1

    if new_count:
        save_gst_metadata(existing)

    return new_count

def save_filtered_amendments(amendments: List[Dict], company_id: Optional[str] = None):
    """Save filtered amendments to backend/data/filtered_amms/"""
    filtered_dir = os.path.join(DATA_DIR, "filtered_amms")
    os.makedirs(filtered_dir, exist_ok=True)
    
    # Create filename with timestamp and optional company ID
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"filtered_{timestamp}"
    if company_id:
        filename += f"_{company_id}"
    filename += ".json"
    
    filepath = os.path.join(filtered_dir, filename)
    
    # Prepare data to save
    data_to_save = {
        "timestamp": timestamp,
        "company_id": company_id,
        "total_count": len(amendments),
        "amendments": amendments
    }
    
    # Save to file
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data_to_save, f, indent=2, ensure_ascii=False)
    
    print(f"Saved {len(amendments)} filtered amendments to {filepath}")
    return filepath

def backfill_metadata_excerpts() -> Dict[str, int]:
    """Scan ALL existing metadata entries and populate description fields."""
    results = {"FSSAI": 0, "DGFT": 0, "GST": 0, "RBI": 0}

    # FSSAI general metadata - force description for ALL entries
    meta = load_metadata()
    updated = 0
    for m in meta:
        if m.get("source") == "FSSAI":
            path = m.get("pdf_path")
            if path and os.path.exists(path):
                text = extract_text_from_file(path)
                if text:
                    # Always regenerate description for FSSAI
                    m["description"] = extract_description(text)
                    updated += 1
    
    if updated:
        save_metadata(meta)
    results["FSSAI"] = updated

    # For DGFT and GST, use existing description or title
    dgft_meta = load_dgft_metadata()
    gst_meta = load_gst_metadata()
    
    # Ensure DGFT entries have description
    for m in dgft_meta:
        if not m.get("description"):
            m["description"] = m.get("title", "DGFT Notification")
    
    # Ensure GST entries have description  
    for m in gst_meta:
        if not m.get("description"):
            m["description"] = m.get("title", "GST Notification")
    
    save_dgft_metadata(dgft_meta)
    save_gst_metadata(gst_meta)

    return results

def get_latest_filtered_amendments() -> List[Dict]:
    """Get the most recent filtered amendments from backend/data/filtered_amms/"""
    filtered_dir = os.path.join(DATA_DIR, "filtered_amms")
    if not os.path.exists(filtered_dir):
        return []
    
    # Find the latest filtered amendments file
    files = [f for f in os.listdir(filtered_dir) if f.startswith("filtered_") and f.endswith(".json")]
    if not files:
        return []
    
    # Sort by timestamp (newest first)
    files.sort(reverse=True)
    latest_file = files[0]
    
    try:
        with open(os.path.join(filtered_dir, latest_file), 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("amendments", [])
    except Exception as e:
        print(f"Error loading filtered amendments: {e}")
        return []