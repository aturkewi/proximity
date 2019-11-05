defmodule Proximity.Repo do
  use Ecto.Repo,
    otp_app: :proximity,
    adapter: Ecto.Adapters.Postgres
end
