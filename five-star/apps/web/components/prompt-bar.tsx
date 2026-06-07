"use client"

import { useRef, useState } from "react"
import { Card } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { ArrowUp, ImagePlus, X } from "lucide-react"

export const MODELS = [
  { id: "minimax/minimax-m3", label: "MiniMax M3" },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
]

export interface PromptBarSubmitPayload {
  model: string
  images: File[]
}

interface PromptBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (payload: PromptBarSubmitPayload) => void
  disabled?: boolean
  placeholder?: string
  toolbarLeft?: React.ReactNode
}

export function PromptBar({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Message your assistant…",
  toolbarLeft,
}: PromptBarProps) {
  const [model, setModel] = useState(MODELS[0]!.id)
  const [images, setImages] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    if (!value.trim() && images.length === 0) return
    onSubmit({ model, images })
    setImages([])
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setImages((prev) => [...prev, ...files])
    e.target.value = ""
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="shrink-0 bg-linear-to-b from-transparent to-background px-2 pt-2 pb-2 sm:px-4 sm:pt-4 sm:pb-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageSelect}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="mx-auto max-w-2xl"
      >
        <Card className="gap-2 px-3 py-2 [--card-spacing:0]">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="group relative size-14 overflow-hidden rounded-lg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(img)}
                    alt={img.name}
                    className="size-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 size-full rounded-none bg-black/40 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <X className="size-3 text-white" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {toolbarLeft}
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-7 max-w-36 gap-1 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground focus:ring-0 [&>span]:truncate [&>svg]:size-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="size-4" />
              </Button>
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={disabled || (!value.trim() && images.length === 0)}
              className="size-7 shrink-0 rounded-lg"
            >
              <ArrowUp className="size-3.5" />
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
