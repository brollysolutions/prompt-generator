"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import { createPortal } from "react-dom";
import { Search, Mail, FileText, Code, Image as ImageIcon, BarChart, Search as SearchIcon, X, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  template_text: string;
  icon: string;
};

const CATEGORIES = ["All", "Email", "Blog", "Coding", "SEO", "Image Generation", "Data Analysis"];

const ICON_MAP: Record<string, React.ReactNode> = {
  "mail": <Mail size={18} />,
  "file-text": <FileText size={18} />,
  "code": <Code size={18} />,
  "search": <SearchIcon size={18} />,
  "image": <ImageIcon size={18} />,
  "bar-chart": <BarChart size={18} />
};

export default function TemplateSection({ onSelect }: { onSelect: (templateText: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        let url = `${getApiUrl()}/api/templates?`;
        if (category !== "All") {
          url += `category=${encodeURIComponent(category)}&`;
        }
        if (search) {
          url += `search=${encodeURIComponent(search)}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setTemplates(data);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchTemplates, 300);
    return () => clearTimeout(debounceTimer);
  }, [search, category]);

  return (
    <div className="w-full bg-white/70 backdrop-blur-md border border-[#D4AF37]/50 rounded-[24px] p-5 md:p-8 mb-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-black text-lg md:text-[22px] font-bold m-0 flex items-center gap-2">
            <div className="w-8 h-8 bg-[#D4AF37] rounded-lg flex items-center justify-center text-black text-sm">
              <FileText size={16} />
            </div>
            Use-Case Templates
          </h2>
          <p className="text-[#D4AF37] text-xs md:text-[13px] mt-1 mb-0 font-medium">
            Pick a ready-made template to get started instantly
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl text-sm focus:outline-none focus:border-[#D4AF37] transition-colors"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="flex overflow-x-auto pb-4 mb-4 gap-2 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              category === cat 
                ? "bg-[#D4AF37] text-black" 
                : "bg-[#f9fafb] text-gray-600 border border-[#e5e7eb] hover:border-[#D4AF37]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No templates found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div 
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className="bg-white border border-[#e5e7eb] rounded-xl p-4 cursor-pointer hover:border-[#D4AF37] hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[#f9fafb] flex items-center justify-center text-[#D4AF37] group-hover:bg-[#D4AF37]/10 transition-colors">
                  {ICON_MAP[template.icon] || <FileText size={16} />}
                </div>
                <h3 className="font-semibold text-sm text-gray-900 m-0">{template.name}</h3>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 m-0 mt-1">
                {template.description}
              </p>
              <div className="mt-3">
                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-medium rounded">
                  {template.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {selectedTemplate && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setSelectedTemplate(null)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-hidden"
              >
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                      {ICON_MAP[selectedTemplate.icon] || <FileText size={20} />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 m-0">{selectedTemplate.name}</h3>
                      <span className="text-xs text-[#D4AF37] font-medium">{selectedTemplate.category}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedTemplate(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-4">{selectedTemplate.description}</p>
                  <div className="bg-[#f9fafb] border border-gray-200 rounded-xl p-4">
                    <p className="text-sm text-gray-800 font-mono whitespace-pre-wrap m-0 leading-relaxed">
                      {selectedTemplate.template_text}
                    </p>
                  </div>
                </div>
                
                <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                  <button 
                    onClick={() => setSelectedTemplate(null)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      onSelect(selectedTemplate.template_text);
                      setSelectedTemplate(null);
                    }}
                    className="px-5 py-2 text-sm font-bold bg-[#D4AF37] text-black rounded-lg hover:bg-[#AA8A27] transition-colors shadow-sm"
                  >
                    Use Template
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
