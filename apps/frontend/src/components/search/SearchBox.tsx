import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export const SEARCH_DEBOUNCE_MS = 300;

type SearchBoxProps =
  | {
      /** Live mode: `onQuery` runs 300 ms after typing stops (or at once on Enter). `value` is the URL's query. */
      value: string;
      onQuery: (q: string) => void;
      onSubmit?: undefined;
    }
  | {
      /** Submit mode: nothing happens until the form is submitted with non-blank text. */
      onSubmit: (q: string) => void;
      value?: undefined;
      onQuery?: undefined;
    };

export function SearchBox(props: SearchBoxProps) {
  const { onQuery, onSubmit } = props;
  const [text, setText] = useState(props.value ?? "");
  const [seenValue, setSeenValue] = useState(props.value);
  const debounced = useDebouncedCallback((q: string) => onQuery?.(q), SEARCH_DEBOUNCE_MS);

  // The URL changed from outside (Back, a header submit): show it, unless it is just the trimmed text.
  // This is React's "adjust state while rendering" pattern: `seenValue` remembers the last prop we saw, so
  // typing "red " (URL: "red") keeps its trailing space and only a real outside change replaces the text.
  if (props.value !== seenValue) {
    setSeenValue(props.value);
    if (props.value !== undefined && props.value !== text.trim()) setText(props.value);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (onQuery) {
      debounced.cancel();
      onQuery(text.trim());
    } else if (text.trim() !== "") {
      onSubmit?.(text.trim());
    }
  };

  return (
    <form role="search" onSubmit={submit} className="flex items-center gap-2">
      <Input
        type="search"
        aria-label="Search notes"
        placeholder="Search notes"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (onQuery) debounced.run(event.target.value.trim());
        }}
      />
      {onQuery ? null : <Button type="submit">Search</Button>}
    </form>
  );
}
