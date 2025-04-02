const procedimientos = [
    { id: 1, nombre: 'Cejas', duracion: 30 },
    { id: 2, nombre: 'Henna', duracion: 45 },
    { id: 3, nombre: 'Pestañas', duracion: 60 }
];

// Estado global
const estado = {
    procedimientoSeleccionado: null,
    fechaSeleccionada: null,
    horaSeleccionada: null,
    citas: [],
    horariosBloqueados: new Set()
};

// Horario de trabajo
const HORARIO_INICIO = 9 * 60; // 9:00AM
const HORARIO_FIN = 20 * 60;   // 8:00PM
const HORA_LIMITE_AGENDAMIENTO = 21 * 60; // 9:00PM

// Función para actualizar la hora actual de Colombia
function actualizarHoraColombia() {
    const ahora = new Date();
    const horaColombia = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const horaFormateada = horaColombia.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
    });
    document.getElementById('hora-actual').textContent = horaFormateada;
}

// Actualizar la hora cada segundo
setInterval(actualizarHoraColombia, 1000);
actualizarHoraColombia(); // Actualizar inmediatamente al cargar

document.addEventListener('DOMContentLoaded', () => {
    cargarProcedimientos();
    inicializarCalendario();
    cargarCitasGuardadas();
});

function cargarProcedimientos() {
    const contenedor = document.getElementById('procedimientos-lista');
    procedimientos.forEach(proc => {
        const elemento = document.createElement('div');
        elemento.className = 'procedimiento-item';
        elemento.innerHTML = `
            <h6>${proc.nombre}</h6>
            <small>Duración: ${proc.duracion} minutos</small>
        `;
        elemento.addEventListener('click', () => seleccionarProcedimiento(proc));
        contenedor.appendChild(elemento);
    });
}

function seleccionarProcedimiento(procedimiento) {
    estado.procedimientoSeleccionado = procedimiento;
    document.querySelectorAll('.procedimiento-item').forEach(el => {
        el.classList.remove('seleccionado');
    });
    event.currentTarget.classList.add('seleccionado');
    actualizarCalendario();
}

function inicializarCalendario() {
    const contenedor = document.getElementById('calendario');
    const hoy = new Date();
    
    // Mostrar próximos 7 días
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + i);
        
        const diaElemento = document.createElement('div');
        diaElemento.className = 'dia-calendario';
        if (i === 0) diaElemento.classList.add('hoy');
        
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        diaElemento.innerHTML = `
            <h6>${fechaFormateada}</h6>
            <div class="horas-disponibles" data-fecha="${fecha.toISOString()}"></div>
        `;
        
        contenedor.appendChild(diaElemento);
        actualizarHorasDisponibles(fecha);
    }
}

function actualizarHorasDisponibles(fecha) {
    const contenedor = document.querySelector(`[data-fecha="${fecha.toISOString()}"]`);
    contenedor.innerHTML = '';
    
    const esManana = fecha.getDate() === new Date().getDate() + 1;
    const esHoy = fecha.getDate() === new Date().getDate() && 
                  fecha.getMonth() === new Date().getMonth() && 
                  fecha.getFullYear() === new Date().getFullYear();
    const horaActual = new Date();
    const horaActualMinutos = horaActual.getHours() * 60 + horaActual.getMinutes();
    
    // Si es el día actual y ya pasó la hora límite, mostrar mensaje
    if (esHoy && horaActualMinutos >= HORARIO_FIN) {
        contenedor.innerHTML = '<p class="text-danger">No se pueden agendar citas para hoy</p>';
        return;
    }
    
    // Verificar si se puede agendar para mañana
    if (esManana && horaActualMinutos >= HORA_LIMITE_AGENDAMIENTO) {
        // Mostrar mensaje solo para horarios antes de las 12:00
        if (horaActualMinutos >= HORA_LIMITE_AGENDAMIENTO) {
            contenedor.innerHTML = '<p class="text-danger">Horarios de la mañana no disponibles</p>';
        }
    }
    
    // Generar slots de tiempo cada 15 minutos
    for (let hora = HORARIO_INICIO; hora < HORARIO_FIN; hora += 15) {
        const horaFormateada = `${Math.floor(hora/60).toString().padStart(2, '0')}:${(hora%60).toString().padStart(2, '0')}`;
        const slotElemento = document.createElement('span');
        const fechaHora = new Date(fecha);
        fechaHora.setHours(Math.floor(hora/60), hora%60, 0, 0);
        
        // Verificar si es mañana y después de las 9:00 PM
        if (esManana && horaActualMinutos >= HORA_LIMITE_AGENDAMIENTO && hora < 12 * 60) {
            slotElemento.className = 'hora-bloqueada';
            slotElemento.textContent = horaFormateada;
        }
        // Verificar si el slot está bloqueado o tiene una cita agendada
        else if (estado.horariosBloqueados.has(fechaHora.toISOString()) || 
            estado.citas.some(cita => {
                const citaInicio = new Date(cita.fecha);
                const citaFin = new Date(citaInicio);
                citaFin.setMinutes(citaInicio.getMinutes() + cita.duracion);
                return fechaHora >= citaInicio && fechaHora < citaFin;
            })) {
            slotElemento.className = 'hora-bloqueada';
            slotElemento.textContent = horaFormateada;
        }
        // Verificar si el slot está disponible
        else if (esSlotDisponible(fecha, hora)) {
            slotElemento.className = 'hora-disponible';
            slotElemento.textContent = horaFormateada;
            slotElemento.addEventListener('click', () => seleccionarHora(fecha, hora));
        }
        // Si no está disponible por otras razones (horario laboral, etc.)
        else {
            slotElemento.className = 'hora-no-disponible';
            slotElemento.textContent = horaFormateada;
        }
        
        contenedor.appendChild(slotElemento);
    }
}

function esSlotDisponible(fecha, hora) {
    const slotInicio = new Date(fecha);
    slotInicio.setHours(Math.floor(hora/60), hora%60, 0, 0);

    // Verificar si es una hora pasada
    const ahora = new Date();
    if (slotInicio < ahora) return false;

    // Verificar horario laboral
    if (hora < HORARIO_INICIO || hora >= HORARIO_FIN) return false;

    const duracion = estado.procedimientoSeleccionado?.duracion || 30;
    const slotFin = new Date(slotInicio);
    slotFin.setMinutes(slotFin.getMinutes() + duracion);

    // Verificar todos los slots de 15 minutos en el periodo
    let slotActual = new Date(slotInicio);
    while (slotActual < slotFin) {
        const slotHora = slotActual.getHours() * 60 + slotActual.getMinutes();
        
        // Verificar horario laboral para cada slot
        if (slotHora >= HORARIO_FIN) return false;
        
        // Verificar si está bloqueado
        if (estado.horariosBloqueados.has(slotActual.toISOString())) {
            return false;
        }

        // Verificar solapamiento con otras citas
        const tieneCita = estado.citas.some(cita => {
            const citaInicio = new Date(cita.fecha);
            const citaFin = new Date(citaInicio);
            citaFin.setMinutes(citaInicio.getMinutes() + cita.duracion);
            
            // Verificar si el slot actual está dentro del rango de la cita existente
            return slotActual >= citaInicio && slotActual < citaFin;
        });

        if (tieneCita) return false;

        slotActual.setMinutes(slotActual.getMinutes() + 15);
    }

    return true;
}

function seleccionarHora(fecha, hora) {
    if (!estado.procedimientoSeleccionado) {
        alert('Por favor, seleccione un procedimiento primero');
        return;
    }
    
    estado.fechaSeleccionada = new Date(fecha);
    estado.fechaSeleccionada.setHours(Math.floor(hora/60), hora%60);
    
    const fechaFormateada = estado.fechaSeleccionada.toLocaleString('es-ES');
    document.getElementById('fecha-seleccionada').textContent = fechaFormateada;
    document.getElementById('procedimiento-seleccionado').textContent = estado.procedimientoSeleccionado.nombre;
    
    const modal = new bootstrap.Modal(document.getElementById('confirmacionModal'));
    modal.show();
}

// Confirmar cita
function confirmarCita() {
    if (!estado.procedimientoSeleccionado || !estado.fechaSeleccionada) {
        alert('Por favor, seleccione un procedimiento y una fecha');
        return;
    }

    // 1. Crear el objeto cita
    const cita = {
        fecha: estado.fechaSeleccionada.toISOString(),
        procedimiento: estado.procedimientoSeleccionado.nombre,
        duracion: estado.procedimientoSeleccionado.duracion
    };

    // 2. Calcular el periodo exacto de la cita
    const fechaInicio = new Date(estado.fechaSeleccionada);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setMinutes(fechaFin.getMinutes() + cita.duracion);

    // 3. Bloquear slots de 15 minutos DENTRO del periodo exacto
    let slotActual = new Date(fechaInicio);
    
    // Asegurar que comenzamos exactamente en el inicio de la cita
    slotActual.setSeconds(0);
    slotActual.setMilliseconds(0);

    while (slotActual < fechaFin) {
        // Solo bloquear si está dentro del periodo de la cita
        if (slotActual >= fechaInicio) {
            estado.horariosBloqueados.add(slotActual.toISOString());
        }
        
        // Avanzar exactamente 15 minutos
        slotActual = new Date(slotActual);
        slotActual.setMinutes(slotActual.getMinutes() + 15);
    }

    // 4. Guardar cambios
    estado.citas.push(cita);
    localStorage.setItem('citas', JSON.stringify(estado.citas));
    localStorage.setItem('horariosBloqueados', JSON.stringify([...estado.horariosBloqueados]));

    // 5. Cerrar modal y actualizar
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmacionModal'));
    modal.hide();
    
    // 6. Limpiar selección
    estado.procedimientoSeleccionado = null;
    estado.fechaSeleccionada = null;
    
    // 7. Actualizar la vista y remover la selección visual
    document.querySelectorAll('.procedimiento-item').forEach(el => {
        el.classList.remove('seleccionado');
    });
    
    // 8. Actualizar el calendario
    actualizarCalendario();
    
    alert('Cita agendada correctamente');
}

function actualizarCalendario() {
    const contenedor = document.getElementById('calendario');
    contenedor.innerHTML = '';
    inicializarCalendario();
    
    // Restaurar la selección del procedimiento si existe
    if (estado.procedimientoSeleccionado) {
        const procedimientos = document.querySelectorAll('.procedimiento-item');
        procedimientos.forEach(proc => {
            if (proc.querySelector('h6').textContent === estado.procedimientoSeleccionado.nombre) {
                proc.classList.add('seleccionado');
            }
        });
    }
}

// Función de testing para borrar todas las citas
document.getElementById('borrar-citas').addEventListener('click', () => {
    if (confirm('¿Está seguro de que desea borrar todas las citas?')) {
        localStorage.removeItem('citas');
        localStorage.removeItem('horariosBloqueados');
        estado.citas = [];
        estado.horariosBloqueados = new Set();
        actualizarCalendario();
        alert('Todas las citas han sido borradas');
    }
});

// Event Listeners
document.getElementById('confirmar-cita').addEventListener('click', confirmarCita); 