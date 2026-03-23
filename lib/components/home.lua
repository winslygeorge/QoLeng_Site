local FunctionalComponent = require("layout.renderer.FuncComponent")
local HTML = require("layout.renderer.LuaHTMLReactive")

local HomePage = FunctionalComponent:extends()
HomePage:setReactiveView()

HomePage.methods.sayHello = function(self, ws_id, args)
 local ops = HTML.client.callModuleFn("window", "alert", {"Hello, World!"})
 self:sendHTMLClientOperations(ws_id, ops)
end

-- Client-side navigation handler
HomePage.methods.handleClientNavigation = function(self, ws_id, args)
    local path = args.path or "/"
    local options = args.options or {}
    
    -- Send to client-side router if available
    local ops = HTML.client.callModuleFn("router", "navigate", {path, options})
    self:sendHTMLClientOperations(ws_id, ops)
    
    -- Also notify server for tracking
    local parent = self:getParent()
    if parent and parent.methods and parent.methods.clientNavigate then
        parent.methods.clientNavigate(parent, ws_id, {path = path, options = options})
    end
end

function HomePage:renderLayout(state, props, children, H)
 return 
 HTML.e("div", { id=props.routeId, class = "route-container route-fade-id bg-[#FBFBFF] text-[#1A1A2E] font-sans transition-all duration-300" }, {
 -- Header
 HTML.e("header", { class = "fixed top-0 left-0 right-0 z-50 py-6 transition-all duration-300 bg-white/80 backdrop-blur-sm" }, {
  HTML.e("div", { class = "container mx-auto px-4" }, {
   HTML.e("div", { class = "flex justify-between items-center" }, {
    HTML.e("div", { class = "flex items-center gap-3" }, {
     HTML.e("div", { class = "w-10 h-10 bg-gradient-to-br from-[#0066FF] to-[#8A2BE2] rounded-lg flex items-center justify-center text-white font-bold" }, "Q"),
     HTML.e("span", { class = "text-2xl font-bold text-[#1A1A2E]" }, "QoLeng")
    }),
    HTML.e("button",
     { class = "bg-white border border-[#E0E5EC] text-[#4A5568] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#F7FAFC] transition-all duration-300 shadow-sm" },
     {
      HTML.e("i", { class = "fas fa-sun" }),
      HTML.e("span", {}, "Light Theme")
     }
    )
   })
  })
 }),
  -- Main Section
HTML.e("section", {
  class = "min-h-screen flex items-center relative overflow-hidden pt-32 transition-all duration-300"
}, {

  HTML.e("div", {
    class = "absolute inset-0 bg-gradient-to-br from-[#0066FF]/10 via-transparent to-[#8A2BE2]/10 pointer-events-none z-0"
  }),

  HTML.e("div", { class = "relative z-10 container mx-auto px-4 text-center" }, {
    -- Headline
    HTML.e("h1", {
      class = "text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-[#0066FF] to-[#8A2BE2] bg-clip-text text-transparent"
    }, "Build Bold.<br>Run Fast.<br>Scale Wild."),

    -- Subheadline
    HTML.e("p", {
      class = "text-xl md:text-2xl text-[#4A5568] mb-8 max-w-3xl mx-auto leading-relaxed transition-all duration-300"
    },
      "QoLeng is a developer's web framework forged for power, precision, and performance. It delivers speed performance, strength, stability, and wild efficiency."
    ),

    -- Slogan Grid
    HTML.e("div", { class = "flex flex-wrap justify-center gap-6 mb-8 transition-all duration-300" }, {
      HTML.e("div", { class = "flex items-center gap-2" }, {
        HTML.e("div", { class = "w-2 h-2 bg-[#0066FF] rounded-full" }),
        HTML.e("span", { class = "font-semibold text-[#1A1A2E]" }, "Strength")
      }),
      HTML.e("div", { class = "flex items-center gap-2" }, {
        HTML.e("div", { class = "w-2 h-2 bg-[#00CC88] rounded-full" }),
        HTML.e("span", { class = "font-semibold text-[#1A1A2E]" }, "Stability")
      }),
      HTML.e("div", { class = "flex items-center gap-2" }, {
        HTML.e("div", { class = "w-2 h-2 bg-[#8A2BE2] rounded-full" }),
        HTML.e("span", { class = "font-semibold text-[#1A1A2E]" }, "Speed")
      }),
      HTML.e("div", { class = "flex items-center gap-2" }, {
        HTML.e("div", { class = "w-2 h-2 bg-[#FFB300] rounded-full" }),
        HTML.e("span", { class = "font-semibold text-[#1A1A2E]" }, "Wild Efficiency")
      })
    }),

    HTML.e("div", { class = "flex flex-wrap justify-center gap-4 mb-12" }, {
      HTML.e("button",
        HTML.merge(
          { class = "bg-[#0066FF] text-white px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-2xl hover:shadow-[#0066FF]/30 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 shadow-lg" },
          HTML.onClick(
            HTML.patch("modalManager", nil, "showModal", {
              modalType = "promptModal",
              modalId = "getStartedModal",
              props = {
              title = "Get Started with QoLeng",
              message = "Welcome to QoLeng! Let embark on a journey to build bold applications, run them fast, and scale with wild efficiency. Click Close to explore more!",
              modalId = "getStartedModal"
            }
            })
          )
        ),
        {
          HTML.e("i", { class = "fas fa-bolt" }),
          "Get Started →"
        }
      ),
        -- Navigation example using handleClientNavigation
        HTML.e("button", 
            HTML.merge({ 
                class = "bg-[#00CC88] text-white px-8 py-4 rounded-lg font-semibold text-lg hover:shadow-2xl hover:shadow-[#00CC88]/30 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 shadow-lg" 
            }, 
                HTML.onClick(
                    HTML.patch("routeManager", nil, "handleClientNavigation", {
                        path = "/app/state",
                        options = { source = "home_page" }
                    })
                )
            ), 
            {
                HTML.e("i", { class = "fas fa-code" }),
                "Go to State Page"
            }
        ),
      HTML.e("button", {
        class = "bg-white border border-[#E0E5EC] text-[#4A5568] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#F7FAFC] hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 shadow-sm"
      }, {
        HTML.e("i", { class = "fas fa-book" }),
        "View Docs"
      }),
      HTML.e("button", {
        class = "bg-white border border-[#E0E5EC] text-[#4A5568] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#F7FAFC] hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 shadow-sm"
      }, {
        HTML.e("i", { class = "fab fa-github" }),
        "GitHub"
      })
    }),

    -- Tagline
    HTML.e("p", {
      class = "text-lg text-[#718096] italic transition-all duration-300"
    },
      "\"Engineered for builders. Optimized for performance. Built for Wild Efficiency.\""
    )
  })
})

})

end

function HomePage:startInit()
 self:init(function(server, children, props, style, H)
  return function(state, props, children, H)
   return self:renderLayout(state, props, children, H)
  end
 end)
end

function HomePage:load()
 self:startInit()
end

return HomePage