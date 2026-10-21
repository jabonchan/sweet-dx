import type { TestSource } from "./types.ts";

/** Builtin types, every spelling of them, cv-qualifiers, pointers, references, arrays and function types. */
export const BUILTINS: TestSource = {
    name: "builtins",
    prelude: "",
    cases: [
        ["void b_void()", "void b_void() {}"],
        ["void b_void_list(void)", "void b_void_list(void) {}"],
        [
            "void b_chars(char, signed char, unsigned char, wchar_t, char8_t, char16_t, char32_t)",
            "void b_chars(char, signed char, unsigned char, wchar_t, char8_t, char16_t, char32_t) {}",
        ],
        [
            "void b_ints(short, unsigned short, int, unsigned int, long, unsigned long, long long, unsigned long long)",
            "void b_ints(short, unsigned short, int, unsigned int, long, unsigned long, long long, unsigned long long) {}",
        ],
        [
            "void b_spellings(short int, long int, long long int, unsigned, signed, short unsigned int, long unsigned, signed int)",
            "void b_spellings(short int, long int, long long int, unsigned, signed, short unsigned int, long unsigned, signed int) {}",
        ],
        [
            "void b_reordered(int unsigned, long long unsigned int, int short, char signed)",
            "void b_reordered(int unsigned, long long unsigned int, int short, char signed) {}",
        ],
        [
            "void b_floats(float, double, long double, bool)",
            "void b_floats(float, double, long double, bool) {}",
        ],
        [
            "int* b_return_type_ignored(int)",
            "int* b_return_type_ignored(int) { return 0; }",
        ],

        // Pointers, cv-qualifiers and references
        [
            "void b_pointers(int*, int**, int***, void*, void const*, void const volatile*)",
            "void b_pointers(int*, int**, int***, void*, void const*, void const volatile*) {}",
        ],
        [
            "void b_cv(int const*, int volatile*, int const volatile*, int* const*, int const* const*, int* volatile*)",
            "void b_cv(int const*, int volatile*, int const volatile*, int* const*, int const* const*, int* volatile*) {}",
        ],
        [
            "void b_east_west_const(const int*, int const*, const char* const*)",
            "void b_east_west_const(const int*, int const*, const char* const*) {}",
        ],
        [
            "void b_refs(int&, int const&, int&&, int const&&, int*&, int* const&)",
            "void b_refs(int&, int const&, int&&, int const&&, int*&, int* const&) {}",
        ],
        [
            "void b_top_level_cv(int const, int* const, int const* const, int volatile)",
            "void b_top_level_cv(int const, int* const, int const* const, int volatile) {}",
        ],

        // Arrays: parameters decay, pointers and references to arrays keep the size
        [
            "void b_array_decay(int[8], char[], int[2][3])",
            "void b_array_decay(int[8], char[], int[2][3]) {}",
        ],
        [
            "void b_array_pointers(int (*)[5], int (&)[5], int const (&)[3], char (*)[2][4])",
            "void b_array_pointers(int (*)[5], int (&)[5], int const (&)[3], char (*)[2][4]) {}",
        ],
        [
            "void b_array_sizes(int (*)[0x10], int (*)[1'000])",
            "void b_array_sizes(int (*)[0x10], int (*)[1'000]) {}",
        ],

        // Function types
        [
            "void b_functions(void (*)(), int (*)(int, char), void (&)(int), void (*)(int, ...), int (*)(void))",
            "void b_functions(void (*)(), int (*)(int, char), void (&)(int), void (*)(int, ...), int (*)(void)) {}",
        ],
        [
            "void b_function_values(void (int), int ())",
            "void b_function_values(void (int), int ()) {}",
        ],
        [
            "void b_noexcept(void (*)() noexcept, void (&)(int) noexcept)",
            "void b_noexcept(void (*)() noexcept, void (&)(int) noexcept) {}",
        ],
        [
            "void b_function_pointer_pointers(void (**)(int), void (* const*)(int), void (*&)(char))",
            "void b_function_pointer_pointers(void (**)(int), void (* const*)(int), void (*&)(char)) {}",
        ],
        [
            "void b_returning_function_pointers(void (*(*)(int))(char))",
            "void b_returning_function_pointers(void (*(*)(int))(char)) {}",
        ],
        [
            "void b_array_of_function_pointers(int (*(*)[3])(long))",
            "void b_array_of_function_pointers(int (*(*)[3])(long)) {}",
        ],
        [
            "void b_same_function_type_twice(void (*)(int), void (*)(int))",
            "void b_same_function_type_twice(void (*)(int), void (*)(int)) {}",
        ],

        // C variadics
        ["void b_variadic(...)", "void b_variadic(...) {}"],
        [
            "int b_printf_like(char const*, ...)",
            "int b_printf_like(char const*, ...) { return 0; }",
        ],
    ],
};
