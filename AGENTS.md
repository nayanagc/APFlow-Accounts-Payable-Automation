<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

APFlow UI and shared feature logic live in focused modules under `src/apflow`, while each public page is declared as a TanStack file route; keep mock data and Django API access in separate modules so the frontend can switch integrations without restructuring the screens.

Keep cross-page APFlow demo workflow state in the shared frontend provider, with demo fixtures and Django API services remaining separate, so simulated decisions stay consistent without implying server persistence.
