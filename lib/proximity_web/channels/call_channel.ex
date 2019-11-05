defmodule ProximityWeb.CallChannel do
  use ProximityWeb, :channel

  def join("call", payload, socket) do
    {:ok, socket}
  end

  def handle_in("message", %{"body" => body}, socket) do
    broadcast! socket, "message", %{body: body}
    {:noreply, socket}
  end
end
