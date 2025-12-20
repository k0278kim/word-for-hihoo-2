"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Word = {
    id: string;
    word: string;
    meaning: string;
    createdAt: number;
};

type Selection = {
    startRow: number;
    startField: "word" | "meaning";
    endRow: number;
    endField: "word" | "meaning";
} | null;

const STORAGE_KEY = "word-sheet-data";

export function WordVocabulary() {
    const [testMode, setTestMode] = useState<"study" | "word" | "meaning">("study");
    const [localWords, setLocalWords] = useState<Word[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [lastSaved, setLastSaved] = useState<number | null>(null);

    // 상태 분리: 선택 vs 편집
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedField, setSelectedField] = useState<"word" | "meaning" | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingField, setEditingField] = useState<"word" | "meaning" | null>(null);

    // 범위 선택
    const [selection, setSelection] = useState<Selection>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [potentialFocus, setPotentialFocus] = useState<{ id: string; field: "word" | "meaning" } | null>(null);
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);

    // Initial Load from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setLocalWords(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved data", e);
            }
        } else {
            setLocalWords([{ id: "initial-1", word: "Experience", meaning: "경험", createdAt: Date.now() }]);
        }
        setIsLoaded(true);
    }, []);

    // Save to LocalStorage whenever data changes (with simple debounce effect via useEffect)
    useEffect(() => {
        if (!isLoaded) return;

        const timeout = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(localWords));
            setLastSaved(Date.now());
        }, 500); // 0.5초 간격으로 디바운스 저장

        return () => clearTimeout(timeout);
    }, [localWords, isLoaded]);

    const handleLocalUpdate = (id: string, field: "word" | "meaning", value: string) => {
        setLocalWords(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    };

    const handleCreateBelow = () => {
        const currentIndex = localWords.findIndex(w => w.id === selectedId);
        const newWord: Word = {
            id: Math.random().toString(36).substring(2, 9),
            word: "",
            meaning: "",
            createdAt: Date.now()
        };

        setLocalWords(prev => {
            const newState = [...prev];
            if (currentIndex !== -1) newState.splice(currentIndex + 1, 0, newWord);
            else newState.push(newWord);
            return newState;
        });

        setSelectedId(newWord.id);
        setSelectedField("word");
        setEditingId(newWord.id);
        setEditingField("word");
    };

    const handleShuffleSelection = () => {
        if (!selection) return;
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        if (minRow === maxRow) return;

        const updatedWords = [...localWords];
        const range = updatedWords.slice(minRow, maxRow + 1);

        // Fisher-Yates Shuffle
        for (let i = range.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [range[i], range[j]] = [range[j]!, range[i]!];
        }

        updatedWords.splice(minRow, range.length, ...range);
        setLocalWords(updatedWords);
    };

    const clearSelection = useCallback(() => {
        if (!selection) return;
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        const fields: ("word" | "meaning")[] = ["word", "meaning"];
        const minFI = Math.min(fields.indexOf(selection.startField), fields.indexOf(selection.endField));
        const maxFI = Math.max(fields.indexOf(selection.startField), fields.indexOf(selection.endField));

        setLocalWords(prev => prev.map((row, r) => {
            if (r >= minRow && r <= maxRow) {
                const newRow = { ...row };
                for (let f = minFI; f <= maxFI; f++) {
                    newRow[fields[f]!] = "";
                }
                return newRow;
            }
            return row;
        }));
        setSelection(null);
    }, [selection]);

    const deleteRow = (id: string) => {
        setLocalWords(prev => prev.filter(w => w.id !== id));
    };

    const deleteAll = () => {
        if (confirm("모든 단어를 삭제하시겠습니까?")) {
            setLocalWords([]);
        }
    };

    const [isComposing, setIsComposing] = useState(false);

    useEffect(() => {
        const handleKeyDownGlobal = (e: KeyboardEvent) => {
            if (isComposing) return; // 한글 조합 중에는 전역 핸들러 차단

            if (selection && (e.key === "Backspace" || e.key === "Delete")) {
                if (editingId === null) { e.preventDefault(); clearSelection(); return; }
            }
            if (selectedId && editingId === null && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
                setEditingId(selectedId);
                setEditingField(selectedField);
            }
            if (e.key === "Enter") {
                if (editingId) { e.preventDefault(); setEditingId(null); }
                else if (selectedId) { e.preventDefault(); handleCreateBelow(); }
            }
            if (e.key === "Tab") {
                // 전역 핸들러에서의 Tab 처리는 포커스된 인풋이 없을 때만 동작하도록 하거나
                // 인풋 내부 핸들러에서 stopPropagation을 쓰도록 유도
                if (!editingId) {
                    e.preventDefault();
                    navigateWithTab(e.shiftKey);
                }
            }

            if (e.key === "Escape") { setEditingId(null); setSelection(null); }
            if (!editingId && selectedId) {
                const index = localWords.findIndex(w => w.id === selectedId);
                if (e.key === "ArrowDown" && index < localWords.length - 1) { e.preventDefault(); setSelectedId(localWords[index + 1]!.id); }
                if (e.key === "ArrowUp" && index > 0) { e.preventDefault(); setSelectedId(localWords[index - 1]!.id); }
                if (e.key === "ArrowRight" && selectedField === "word") { e.preventDefault(); setSelectedField("meaning"); }
                if (e.key === "ArrowLeft" && selectedField === "meaning") { e.preventDefault(); setSelectedField("word"); }
            }
        };
        window.addEventListener("keydown", handleKeyDownGlobal);
        return () => window.removeEventListener("keydown", handleKeyDownGlobal);
    }, [selectedId, selectedField, editingId, editingField, selection, clearSelection, localWords, isComposing]);

    const navigateWithTab = (isShift: boolean) => {
        const activeId = editingId || selectedId;
        const activeField = editingId ? editingField : selectedField;
        const index = localWords.findIndex(w => w.id === activeId);

        if (index === -1) return;

        if (!isShift) { // Forward
            if (activeField === "word") {
                setSelectedId(localWords[index]!.id);
                setSelectedField("meaning");
                if (editingId) { setEditingId(localWords[index]!.id); setEditingField("meaning"); }
            } else {
                const next = localWords[index + 1];
                if (next) {
                    setSelectedId(next.id);
                    setSelectedField("word");
                    if (editingId) { setEditingId(next.id); setEditingField("word"); }
                } else {
                    handleCreateBelow();
                }
            }
        } else { // Backward
            if (activeField === "meaning") {
                setSelectedId(localWords[index]!.id);
                setSelectedField("word");
                if (editingId) { setEditingId(localWords[index]!.id); setEditingField("word"); }
            } else {
                const prev = localWords[index - 1];
                if (prev) {
                    setSelectedId(prev.id);
                    setSelectedField("meaning");
                    if (editingId) { setEditingId(prev.id); setEditingField("meaning"); }
                }
            }
        }
    };

    const onMouseDown = (row: number, field: "word" | "meaning", x: number, y: number) => {
        setIsDragging(true); dragStartPos.current = { x, y }; setEditingId(null);
        setSelectedId(localWords[row]?.id ?? null); setSelectedField(field);
        setSelection({ startRow: row, startField: field, endRow: row, endField: field });
        setPotentialFocus({ id: localWords[row]!.id, field });
    };

    const onMouseEnter = (row: number, field: "word" | "meaning") => {
        if (isDragging && selection) setSelection({ ...selection, endRow: row, endField: field });
    };

    const onMouseUp = useCallback(() => {
        const isSmall = !selection || (selection.startRow === selection.endRow && selection.startField === selection.endField);
        if (isDragging && potentialFocus && isSmall) { setSelectedId(potentialFocus.id); setSelectedField(potentialFocus.field); setSelection(null); }
        setIsDragging(false); setPotentialFocus(null);
    }, [isDragging, potentialFocus, selection]);

    useEffect(() => {
        window.addEventListener("mouseup", onMouseUp);
        return () => window.removeEventListener("mouseup", onMouseUp);
    }, [onMouseUp]);

    const isSelected = (row: number, field: "word" | "meaning") => {
        if (!selection) return selectedId === localWords[row]?.id && selectedField === field;
        const minRow = Math.min(selection.startRow, selection.endRow), maxRow = Math.max(selection.startRow, selection.endRow);
        const fields: ("word" | "meaning")[] = ["word", "meaning"];
        const minF = Math.min(fields.indexOf(selection.startField), fields.indexOf(selection.endField));
        const maxF = Math.max(fields.indexOf(selection.startField), fields.indexOf(selection.endField));
        const curF = fields.indexOf(field);
        return row >= minRow && row <= maxRow && curF >= minF && curF <= maxF;
    };

    const isMultiRowSelected = selection && Math.abs(selection.startRow - selection.endRow) > 0;

    return (
        <div className={`w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 ${isDragging ? "select-none" : ""}`}>
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900 italic">Word Sheet</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-neutral-400 text-sm">브라우저에 자동 저장되는 나만의 영단어장</p>
                        {lastSaved && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full animate-pulse">
                                <div className="w-1 h-1 bg-green-500 rounded-full" />
                                저장됨
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl">
                    {isMultiRowSelected && (
                        <button onClick={handleShuffleSelection} className="px-4 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200">인쇄 인덱스 셔플</button>
                    )}
                    <button onClick={() => setTestMode("study")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${testMode === "study" ? "bg-white shadow-sm" : "text-neutral-500"}`}>학습</button>
                    <button onClick={() => setTestMode("word")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${testMode === "word" ? "bg-white shadow-sm" : "text-neutral-500"}`}>단어 시험</button>
                    <button onClick={() => setTestMode("meaning")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${testMode === "meaning" ? "bg-white shadow-sm" : "text-neutral-500"}`}>뜻 시험</button>
                    <div className="w-px h-3 bg-neutral-300 mx-1" />
                    <button onClick={deleteAll} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-neutral-200/50 transition-all">초기화</button>
                    <div className="w-px h-3 bg-neutral-300 mx-1" />
                    <button onClick={() => window.print()} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-700 bg-neutral-200 hover:bg-neutral-300 px-6 transition-all">인쇄</button>
                </div>
            </header>

            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
                <div className="grid grid-cols-1 print:p-0">
                    {localWords.map((item, index) => (
                        <div key={item.id} className="group flex items-stretch border-b border-neutral-100 min-h-[3rem] print:border-black print:break-inside-avoid">
                            <div onMouseDown={(e) => { e.preventDefault(); onMouseDown(index, "word", e.clientX, e.clientY); }} onMouseEnter={() => onMouseEnter(index, "word")} className="w-10 flex items-center justify-center text-[9px] font-mono text-neutral-300 bg-neutral-50/30 cursor-cell print:num-col">{String(index + 1).padStart(2, "0")}</div>

                            <div
                                onMouseDown={(e) => { e.preventDefault(); onMouseDown(index, "word", e.clientX, e.clientY); }} onMouseEnter={() => onMouseEnter(index, "word")} onDoubleClick={() => { setSelectedId(item.id); setSelectedField("word"); setEditingId(item.id); setEditingField("word"); }}
                                className={`flex-1 min-w-0 border-r border-neutral-100 flex items-center px-4 transition-colors relative cursor-cell print:border-sep print:px-2 ${isSelected(index, "word") ? "bg-blue-50/80 ring-2 ring-inset ring-blue-300 z-10 print:bg-transparent print:ring-0" : ""}`}
                            >
                                {testMode === "word" ? (
                                    <div className="w-full border-b border-neutral-200 print:border-black h-1 mt-4 print:mt-1 print:h-[8pt]"></div>
                                ) : editingId === item.id && editingField === "word" ? (
                                    <input
                                        autoFocus
                                        value={item.word}
                                        onChange={(e) => handleLocalUpdate(item.id, "word", e.target.value)}
                                        onCompositionStart={() => setIsComposing(true)}
                                        onCompositionEnd={() => setIsComposing(false)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Tab") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (!isComposing) navigateWithTab(e.shiftKey);
                                            }
                                        }}
                                        className="w-full h-full bg-transparent outline-none font-medium text-neutral-900 print:text-[10pt]"
                                    />
                                ) : (
                                    <span className="truncate font-medium text-neutral-900 print:text-[10pt]">{item.word}</span>
                                )}
                            </div>

                            <div
                                onMouseDown={(e) => { e.preventDefault(); onMouseDown(index, "meaning", e.clientX, e.clientY); }} onMouseEnter={() => onMouseEnter(index, "meaning")} onDoubleClick={() => testMode === "study" && (setSelectedId(item.id), setSelectedField("meaning"), setEditingId(item.id), setEditingField("meaning"))}
                                className={`flex-1 min-w-0 flex items-center px-4 transition-colors relative cursor-cell print:px-2 ${isSelected(index, "meaning") ? "bg-blue-50/80 ring-2 ring-inset ring-blue-300 z-10 print:bg-transparent print:ring-0" : ""}`}
                            >
                                {testMode === "meaning" ? (
                                    <div className="w-full border-b border-neutral-200 print:border-black h-1 mt-4 print:mt-1 print:h-[8pt]"></div>
                                ) : editingId === item.id && editingField === "meaning" ? (
                                    <input
                                        autoFocus
                                        value={item.meaning}
                                        onChange={(e) => handleLocalUpdate(item.id, "meaning", e.target.value)}
                                        onCompositionStart={() => setIsComposing(true)}
                                        onCompositionEnd={() => setIsComposing(false)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Tab") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (!isComposing) navigateWithTab(e.shiftKey);
                                            }
                                        }}
                                        className="w-full h-full bg-transparent outline-none text-neutral-600 print:text-[9pt] print:text-black"
                                    />
                                ) : (
                                    <span className="truncate text-neutral-500 print:text-black print:text-[9pt]">{item.meaning}</span>
                                )}
                            </div>

                            <button onClick={() => deleteRow(item.id)} className="w-10 flex items-center justify-center text-neutral-200 hover:text-red-500 opacity-0 group-hover:opacity-100 print:hidden transition-all"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                    ))}
                    <button onClick={() => setLocalWords(prev => [...prev, { id: Math.random().toString(36).substring(2, 9), word: "", meaning: "", createdAt: Date.now() }])} className="flex items-center gap-2 p-5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50/50 transition-all print:hidden w-full text-left border-t border-neutral-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg><span className="text-xs font-bold uppercase tracking-wider">Add To End</span></button>
                </div>
            </div>

            <footer className="hidden print:grid grid-cols-3 gap-12 mt-12 px-2 py-6 border-t border-black text-neutral-600">
                <div className="space-y-3">
                    <div className="flex items-center gap-2"><span className="font-bold text-black text-[9pt] w-12">NAME</span><div className="flex-1 border-b border-black h-4"></div></div>
                    <div className="flex items-center gap-2"><span className="font-bold text-black text-[9pt] w-12">DATE</span><div className="flex-1 border-b border-black h-4">{new Date().toLocaleDateString()}</div></div>
                </div>
                <div className="flex flex-col items-center justify-center">
                    <span className="text-[10pt] font-bold text-black uppercase">Word Sheet Test</span>
                    <span className="text-[7pt] text-neutral-400 mt-1">Total {localWords.length} Words</span>
                </div>
                <div className="flex flex-col items-end justify-center">
                    <div className="w-20 h-20 border border-black rounded-lg flex flex-col items-center justify-center relative">
                        <span className="text-[7pt] font-bold text-black absolute top-2">SCORE</span>
                        <span className="text-xl font-light text-black">/ {localWords.length}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
