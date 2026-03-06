"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Settings2, Upload, Loader2, CheckCircle2, X, AlertTriangle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextareaAutosize from "react-textarea-autosize";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { PROVIDERS } from "@/lib/constants";

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
  rateLimitedModels?: Set<string>;
  switchNotice?: string | null;
  onDismissSwitchNotice?: () => void;
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
  onFileUpload,
  rateLimitedModels = new Set(),
  switchNotice = null,
  onDismissSwitchNotice,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice Input State
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  // Drag & Drop State
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0 || !e.relatedTarget) {
      setDragActive(false);
      dragCounter.current = 0;
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounter.current = 0;

    if (globalUploading || !e.dataTransfer.files || !e.dataTransfer.files[0]) return;
    await onFileUpload(e.dataTransfer.files[0]);
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Try Chrome, Edge, or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    let currentFinal = input ? input + (input.endsWith(" ") ? "" : " ") : "";

    recognition.onresult = (event: any) => {
      let interim = "";
      let newFinal = currentFinal;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newFinal += event.results[i][0].transcript + " ";
          currentFinal = newFinal;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      handleInputChange({ target: { value: newFinal + interim } } as any);
    };

    recognition.onerror = (e: any) => {
      console.error("Speech recognition error", e.error);
      if (e.error === "not-allowed") {
        alert("Microphone access was denied. Please click the microphone icon in your browser's address bar to allow access and try again.");
      }
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

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

  function getModelName(idString: string) {
    if (!idString || idString === "default") return "Default Model";
    const [provId, modId] = idString.split("::");
    const p = PROVIDERS.find((x) => x.id === provId);
    if (p && "suggestedModels" in p && p.suggestedModels) {
      const sm = p.suggestedModels.find((m) => m.id === modId);
      if (sm) return sm.name;
    }
    return modId || "Model";
  }

  return (
    <div className="shrink-0 bg-background p-4 pb-6 w-full relative">
      <div className="mx-auto max-w-5xl relative">
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

        {/* Switch notice banner */}
        {switchNotice && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 mb-1 text-xs text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {switchNotice}
            </div>
            <button onClick={onDismissSwitchNotice} className="shrink-0 hover:opacity-70">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form 
          onSubmit={handleSubmit}
          className="relative flex flex-col rounded-2xl bg-card border border-border focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all shadow-sm"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {dragActive && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-card/90 backdrop-blur-[2px] border-2 border-dashed border-primary">
              <div className="flex flex-col items-center gap-1.5 text-primary pointer-events-none">
                <Upload className="h-6 w-6 animate-bounce" />
                <span className="font-semibold text-sm">Drop file to attach</span>
              </div>
            </div>
          )}

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
                  <SelectTrigger className="h-7 w-fit max-w-[180px] gap-2 border-transparent bg-muted/50 text-xs hover:border-border/50 rounded-full focus:ring-0 cursor-pointer">
                    <SelectValue>
                      {selectedModel && availableModels.length > 0
                        ? (availableModels.find((m) => `${m.provider}::${m.id}` === selectedModel)?.name ?? getModelName(selectedModel))
                        : getModelName(selectedModel)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent position="popper" side="top" className="max-h-[300px]">
                    {availableModels.length === 0 ? (
                      <SelectItem value={selectedModel || "default"} className="cursor-pointer">
                        {getModelName(selectedModel)}
                      </SelectItem>
                    ) : (
                      availableModels.map((m) => {
                        const key = `${m.provider}::${m.id}`;
                        const isRateLimited = rateLimitedModels.has(key);
                        return (
                          <SelectItem key={key} value={key} disabled={isRateLimited} className={`cursor-pointer ${isRateLimited ? "opacity-40" : ""}`}>
                            <span className="flex items-center gap-1.5">
                              {isRateLimited && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                              <span className={isRateLimited ? "line-through" : ""}>{m.name}</span>
                              {isRateLimited && <span className="text-[10px] text-amber-500">(limited)</span>}
                            </span>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>

                 <Select value={chatMode} onValueChange={setChatMode}>
                  <SelectTrigger className="h-7 w-fit gap-2 border-transparent bg-transparent text-xs hover:border-border/50 rounded-full focus:ring-0 text-muted-foreground hover:text-foreground cursor-pointer">
                    <div className="flex items-center">
                      <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                      <SelectValue placeholder="Mode" />
                    </div>
                  </SelectTrigger>
                  <SelectContent position="popper" side="top">
                    <SelectItem value="normal" className="cursor-pointer">Normal</SelectItem>
                    <SelectItem value="exam" className="cursor-pointer">Exam</SelectItem>
                    <SelectItem value="learn" className="cursor-pointer">Learn</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 px-3 text-xs bg-transparent text-muted-foreground hover:text-foreground rounded-full border border-transparent hover:border-border/50 cursor-pointer"
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
             <div className="flex items-center gap-1 sm:gap-2">
               <Button 
                 type="button"
                 onClick={toggleListening}
                 variant="ghost"
                 className={`h-8 w-8 shrink-0 rounded-full p-0 transition-colors ${
                   isListening 
                    ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-600 animate-pulse" 
                    : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                 }`}
               >
                 <Mic className="h-4 w-4" />
               </Button>
               <Button 
                 type="submit"
                 disabled={isSubmitting || !input.trim()}
                 className="h-8 w-8 shrink-0 bg-primary/20 hover:bg-primary/30 text-primary rounded-full p-0 disabled:opacity-50 transition-colors"
               >
                 <Send className="h-4 w-4" />
               </Button>
             </div>
          </div>
        </form>
        <div className="mt-3 text-center text-xs text-muted-foreground/50">
          Weston can make formatting errors. Review documents carefully.
        </div>
      </div>
    </div>
  );
}
