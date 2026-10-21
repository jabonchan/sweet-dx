import type { TestSource } from "./types.ts";

const MANY = Array.from({ length: 13 }, (_, i) => `n::T${i}`);

/** Namespaces, nested classes, enums and unions, and the <substitution> table (S_, S0_ ... SA_ ...). */
export const NAMES: TestSource = {
    name: "names",
    prelude: String.raw`
        struct Global {};
        enum Plain { PlainA };
        enum class Scoped : unsigned char { A };
        union Bits { int i; float f; };

        namespace a {
            struct X {};
            namespace b {
                struct X {};
                namespace c {
                    struct X {};
                    struct Deep { struct Inner { struct Innermost {}; void method(X, Innermost*); }; };
                }
            }
        }

        namespace sweetdx { namespace game { namespace actors {
            struct ActorBase {};
            struct PlayerController {};
            enum class State : int { Idle };
        } } }

        namespace n { ${
        Array.from({ length: 13 }, (_, i) => `struct T${i} {};`).join(" ")
    } }
        namespace ns { struct ns {}; }
    `,
    cases: [
        [
            "void n_global(Global, Plain, Scoped, Bits)",
            "void n_global(Global, Plain, Scoped, Bits) {}",
        ],
        [
            "void n_same_names(a::X, a::b::X, a::b::c::X, a::X, a::b::c::X)",
            "void n_same_names(a::X, a::b::X, a::b::c::X, a::X, a::b::c::X) {}",
        ],
        [
            "void n_deep(a::b::c::Deep::Inner::Innermost*, a::b::c::Deep::Inner&)",
            "void n_deep(a::b::c::Deep::Inner::Innermost*, a::b::c::Deep::Inner&) {}",
        ],
        [
            "void a::b::c::Deep::Inner::method(a::b::c::X, a::b::c::Deep::Inner::Innermost*)",
            "void a::b::c::Deep::Inner::method(X, Innermost*) {}",
        ],
        [
            "void sweetdx::game::actors::n_in_namespace(sweetdx::game::actors::ActorBase*, sweetdx::game::actors::PlayerController const&, sweetdx::game::actors::State)",
            "namespace sweetdx { namespace game { namespace actors { void n_in_namespace(ActorBase*, PlayerController const&, State) {} } } }",
        ],
        [
            "void n_ns_ns(ns::ns, ns::ns*, ns::ns const&)",
            "void n_ns_ns(ns::ns, ns::ns*, ns::ns const&) {}",
        ],
        [
            `void n_many_substitutions(${
                MANY.join(", ")
            }, n::T12, n::T0, n::T10, n::T11)`,
            `void n_many_substitutions(${
                MANY.join(", ")
            }, n::T12, n::T0, n::T10, n::T11) {}`,
        ],
        [
            "void n_pointer_substitutions(a::X*, a::X**, a::X const*, a::X* const*, a::X&)",
            "void n_pointer_substitutions(a::X*, a::X**, a::X const*, a::X* const*, a::X&) {}",
        ],
        [
            "void n_name_longer_than_ten_characters(sweetdx::game::actors::ActorBase)",
            "void n_name_longer_than_ten_characters(sweetdx::game::actors::ActorBase) {}",
        ],
        [
            "void _n_underscores_and_digits_2x(int)",
            "void _n_underscores_and_digits_2x(int) {}",
        ],
        [
            "void n_leading_scope(::Global, ::a::X)",
            "void n_leading_scope(::Global, ::a::X) {}",
        ],
    ],
};
