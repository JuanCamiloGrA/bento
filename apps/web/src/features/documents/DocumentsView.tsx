import { SearchView } from "../search";
import type { SearchViewProps } from "../search";

export function DocumentsView(props: Omit<SearchViewProps, "scope">) {
  return <SearchView {...props} scope="documents" />;
}
