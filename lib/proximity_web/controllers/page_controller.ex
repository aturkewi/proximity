defmodule ProximityWeb.PageController do
  use ProximityWeb, :controller

  def index(conn, _params) do
    render(conn, "index.html")
  end
end
