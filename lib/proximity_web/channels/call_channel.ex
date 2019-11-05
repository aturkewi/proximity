defmodule ProximityWeb.CallChannel do
  use ProximityWeb, :channel

  def join("call", payload, socket) do
    {:ok, assign(socket, :member_id, Ecto.UUID.generate)}
  end

  def handle_in("here", _params, socket) do
    broadcast! socket, "new_member", %{member_id: socket.assigns.member_id}
    {:noreply, socket}
  end

  def handle_in("close_connection", _params, socket) do
    broadcast! socket, "member_left", %{member_id: socket.assigns.member_id}
    {:noreply, socket}
  end

  def handle_in("message", %{"body" => body}, socket) do
    broadcast! socket, "message", %{body: body, member_id: socket.assigns.member_id}
    {:noreply, socket}
  end
end
