/** Tree-sitter node types skipped when looking for the meaningful child of a declarator. */
export const IRRELEVANT_NODES = [
    "*",
    "&",
    "&&",
    "(",
    ")",
    "...",
    "type_qualifier",
    "ms_pointer_modifier",
    "attribute_specifier",
    "whitespace",
    "comment",
];

/** Tree-sitter node types that hold a (possibly qualified) name. */
export const NAME_NODES = [
    "identifier",
    "field_identifier",
    "type_identifier",
    "namespace_identifier",
    "qualified_identifier",
    "template_function",
    "template_method",
    "operator_name",
    "destructor_name",
    "operator_cast",
];

/** Specifiers that don't affect the mangled name (`static`, `virtual`, `explicit`...). */
export const FUNCTION_SPECIFIERS = [
    "storage_class_specifier",
    "virtual",
    "virtual_function_specifier",
    "explicit_function_specifier",
];
