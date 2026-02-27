"use client";

import { useState, useRef } from "react";
import { Send, Paperclip, Settings2, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextareaAutosize from "react-textarea-autosize";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { ManageModelsDialog } from "./ManageModelsDialog";

interface ModelOption {
  provider: string;
  id: string;
  name: string;
}

interface ChatInputProps {
  chatId: string;
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  availableModels: ModelOption[];
  onModelsChange?: () => void;
  chatMode: string;
  setChatMode: (value: string) => void;
  globalUploading: boolean;
  globalLastUploadedName: string | null;
  onFileUpload: (file: File) => Promise<void>;
}

export function ChatInput({ 
  chatId, 
  input, 
  handleInputChange, 
  handleSubmit, 
  isSubmitting, 
  selectedModel, 
  setSelectedModel, 
  availableModels, 
  onModelsChange, 
  chatMode, 
  setChatMode,
  globalUploading,
  globalLastUploadedName,
  onFileUpload
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isSubmitting) return;
      handleSubmit(e);
    }
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await onFileUpload(file);
    // Reset so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="shrink-0 bg-background p-4 pb-6 w-full relative">
      <div className="mx-auto max-w-3xl relative">
        {/* Upload Status / Success indicators */}
        <div className="h-6 mb-1 px-2 flex items-center justify-end">
          {globalUploading && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-transparent h-5 text-[10px] animate-pulse">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Uploading source...
            </Badge>
          )}
          {!globalUploading && globalLastUploadedName && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-transparent h-5 text-[10px]">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Attached {globalLastUploadedName}
            </Badge>
          )}
        </div>

        <form 
          onSubmit={handleSubmit}
          className="relative flex flex-col rounded-2xl bg-card border border-border focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all shadow-sm"
        >

          <TextareaAutosize
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder="Ask Weston..."
            maxRows={8}
            className="w-full resize-none bg-transparent px-4 py-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[56px]"
          />
          <div className="flex items-center justify-between px-3 py-2 pb-3">
             <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                 <Select value={selectedModel} onValueChange={setSelectedModel}>
                   <SelectTrigger className="h-7 w-fit gap-2 border-transparent bg-muted/50 text-xs hover:border-border/50 rounded-full focus:ring-0">
                     <SelectValue placeholder="Model" />
                   </SelectTrigger>
                   <SelectContent position="popper" side="top" className="max-h-[300px]">
                     {availableModels.length === 0 ? (
                       <SelectItem value="default">Default Model</SelectItem>
                     ) : (
                       availableModels.map((m) => (
                         <SelectItem key={`${m.provider}::${m.id}`} value={`${m.provider}::${m.id}`}>
                           {m.name}
                         </SelectItem>
                       ))
                     )}
                   </SelectContent>
                 </Select>

                 <Select value={chatMode} onValueChange={setChatMode}>
                   <SelectTrigger className="h-7 w-fit gap-2 border-transparent bg-transparent text-xs hover:border-border/50 rounded-full focus:ring-0 text-muted-foreground hover:text-foreground">
                     <div className="flex items-center">
                       <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                       <SelectValue placeholder="Mode" />
                     </div>
                   </SelectTrigger>
                   <SelectContent position="popper" side="top">
                     <SelectItem value="oracle">Oracle (Normal)</SelectItem>
                     <SelectItem value="exam">Exam (Speed/Summary)</SelectItem>
                     <SelectItem value="learn">Learn (Curiosity/Tutor)</SelectItem>
                   </SelectContent>
                 </Select>

                 <Button 
                   type="button" 
                   variant="ghost" 
                   onClick={() => fileInputRef.current?.click()}
                   className="h-7 px-3 text-xs bg-transparent text-muted-foreground hover:text-foreground rounded-full border border-transparent hover:border-border/50"
                 >
                   <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Attach
                 </Button>
                 <input
                   type="file"
                   accept=".pdf,.txt,.md"
                   className="hidden"
                   ref={fileInputRef}
                   onChange={handleFileUpload}
                   disabled={globalUploading}
                 />
             </div>
             <Button 
               type="submit"
               disabled={isSubmitting || !input.trim()}
               className="h-8 w-8 shrink-0 bg-primary/20 hover:bg-primary/30 text-primary rounded-full p-0 disabled:opacity-50 transition-colors"
             >
               <Send className="h-4 w-4" />
             </Button>
          </div>
        </form>
        <div className="mt-3 text-center text-xs text-muted-foreground/50">
          Weston can make formatting errors. Review documents carefully.
        </div>
      </div>
    </div>
  );
}
